import { startOfWeek, type MealSlot } from '@recetapp/contracts';

import type { MealPlanRepository } from '@/features/meal-plan/domain/meal-plan-repository';
import { mealPlanEntryToRow } from '@/features/meal-plan/infrastructure/synced-meal-plan-repository';
import type { PantryRepository } from '@/features/pantry/domain/pantry-repository';
import {
  entryToRow,
  rowToEntry,
  type PantryRow,
} from '@/features/pantry/infrastructure/pantry-mappers';
import type { ShoppingChecksRepository } from '@/features/shopping-list/domain/shopping-checks-repository';
import { decodeKey, type SyncEntityName } from '@/shared/sync/sync-entities';

import type { EntityStore, RemoteRow } from '../domain/ports';

function text(row: RemoteRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') throw new Error(`Column "${column}" must be text.`);
  return value;
}

function number(row: RemoteRow, column: string): number {
  const value = row[column];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Column "${column}" must be a number.`);
  }
  return value;
}

function optionalNumber(row: RemoteRow, column: string): number | null {
  return row[column] === null || row[column] === undefined ? null : number(row, column);
}

function optionalText(row: RemoteRow, column: string): string | null {
  return row[column] === null || row[column] === undefined ? null : text(row, column);
}

/**
 * Pantry rows share their shape with the local table, so the existing mapper
 * does the validation: a row that violates a domain invariant throws here
 * instead of reaching the app as a malformed entry.
 */
export function createPantryEntityStore(repository: PantryRepository): EntityStore {
  return {
    async readAll() {
      const entries = await repository.findAll();
      return entries.map((entry) => ({ ...entryToRow(entry) }));
    },
    async upsert(row) {
      const pantryRow: PantryRow = {
        ingredient_id: text(row, 'ingredient_id'),
        display_name: text(row, 'display_name'),
        category: text(row, 'category'),
        default_unit: text(row, 'default_unit'),
        amount: number(row, 'amount'),
        unit: text(row, 'unit'),
        threshold_amount: optionalNumber(row, 'threshold_amount'),
        threshold_unit: optionalText(row, 'threshold_unit'),
        expires_at: optionalNumber(row, 'expires_at'),
      };
      await repository.save(rowToEntry(pantryRow));
    },
    async remove(key) {
      await repository.remove(decodeKey(key)[0]);
    },
    async clear() {
      for (const entry of await repository.findAll()) {
        await repository.remove(entry.ingredient.id);
      }
    },
  };
}

const SLOTS: readonly string[] = ['breakfast', 'lunch', 'dinner'];

export function createMealPlanEntityStore(repository: MealPlanRepository): EntityStore {
  return {
    async readAll() {
      const entries = await repository.findAll();
      return entries.map(mealPlanEntryToRow);
    },
    async upsert(row) {
      const slot = text(row, 'slot');
      const ingredients = row.ingredients;
      if (!SLOTS.includes(slot)) throw new Error(`Unknown meal slot "${slot}".`);
      if (!Array.isArray(ingredients) || !ingredients.every((item) => typeof item === 'string')) {
        throw new Error('Column "ingredients" must be a list of text.');
      }

      const date = text(row, 'date');
      const dishId = text(row, 'dish_id');

      // Amounts never travel: the remote row has no column for them. Replacing
      // the entry would wipe the ones this device stored, so they survive as
      // long as the slot still holds the same dish. A different dish makes
      // them wrong, and then the names are all there is.
      const local = (await repository.findByWeek(startOfWeek(date))).find(
        (entry) => entry.date === date && entry.slot === slot,
      );
      const recipeIngredients = local?.dishId === dishId ? local.recipeIngredients : undefined;

      await repository.upsertMany([
        {
          date,
          slot: slot as MealSlot,
          dishId,
          dishTitle: text(row, 'dish_title'),
          summary: text(row, 'summary'),
          ingredients,
          ...(recipeIngredients ? { recipeIngredients } : {}),
        },
      ]);
    },
    async remove(key) {
      const [date, slot] = decodeKey(key);
      await repository.clear(date, slot as MealSlot);
    },
    async clear() {
      for (const entry of await repository.findAll()) {
        await repository.clear(entry.date, entry.slot);
      }
    },
  };
}

export function createShoppingEntityStore(repository: ShoppingChecksRepository): EntityStore {
  return {
    async readAll() {
      const checks = await repository.findAll();
      return checks.map((check) => ({ item_key: check.key, name: check.name }));
    },
    async upsert(row) {
      await repository.check({ key: text(row, 'item_key'), name: text(row, 'name') });
    },
    async remove(key) {
      await repository.uncheck(decodeKey(key)[0]);
    },
    async clear() {
      for (const check of await repository.findAll()) {
        await repository.uncheck(check.key);
      }
    },
  };
}

export type EntityStores = Record<SyncEntityName, EntityStore>;
