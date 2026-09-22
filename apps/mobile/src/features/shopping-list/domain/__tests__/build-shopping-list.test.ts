import type { MealPlanEntryDto } from '@recetapp/contracts';

import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { buildShoppingList } from '@/features/shopping-list/domain/build-shopping-list';

function pantryEntry(name: string, amount: number, threshold: number | null): PantryEntry {
  const id = name.toLowerCase();
  return {
    ingredient: createIngredient({ id, name, category: 'other', defaultUnit: 'g' }),
    item: createPantryItem({
      ingredientId: id,
      quantity: makeQuantity(amount, 'g'),
      lowStockThreshold: threshold === null ? null : makeQuantity(threshold, 'g'),
    }),
  };
}

function planEntry(dishTitle: string, ingredients: string[]): MealPlanEntryDto {
  return {
    date: '2026-09-21',
    slot: 'dinner',
    dishId: dishTitle.toLowerCase().replace(/\s+/g, '-'),
    dishTitle,
    summary: '',
    ingredients,
  };
}

const preferences = { ...DEFAULT_PREFERENCES, staples: ['salt', 'water'] };

describe('buildShoppingList', () => {
  it('is empty when nothing is low and the week needs nothing new', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 500, 100)],
      planEntries: [planEntry('Tomato salad', ['tomato'])],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('lists an ingredient that has run low', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 50, 500)],
      planEntries: [],
      preferences,
    });

    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Flour');
    expect(list[0].reasons).toEqual(['low-stock']);
  });

  it('ignores an item with no threshold, since the user never asked to be warned', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 1, null)],
      planEntries: [],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('lists what the week needs and the pantry does not have', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 500, null)],
      planEntries: [planEntry('Pasta', ['tomato', 'pasta'])],
      preferences,
    });

    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('pasta');
    expect(list[0].reasons).toEqual(['missing-for-plan']);
  });

  it('never asks you to buy a staple you said is always there', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Boiled egg', ['salt', 'water'])],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('says which dishes need an ingredient, so the list explains itself', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Pasta', ['pasta']), planEntry('Lasagna', ['pasta'])],
      preferences,
    });

    expect(list[0].neededFor).toEqual(['Pasta', 'Lasagna']);
  });

  it('does not repeat a dish that uses the same ingredient twice', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Pasta', ['pasta', 'Pasta'])],
      preferences,
    });

    expect(list[0].neededFor).toEqual(['Pasta']);
  });

  it('gives both reasons when something is low and the week also needs it', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 50, 500)],
      planEntries: [planEntry('Pasta', ['tomato'])],
      preferences,
    });

    expect(list).toHaveLength(1);
    expect(list[0].reasons).toEqual(['low-stock']);
    expect(list[0].neededFor).toEqual(['Pasta']);
  });

  it('matches across spellings, so an accent does not create a second row', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Limón', 10, 100)],
      planEntries: [planEntry('Lemonade', ['limon'])],
      preferences,
    });

    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Limón');
  });

  it('puts what the week is missing above what is merely running low', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 10, 500)],
      planEntries: [planEntry('Pasta', ['pasta'])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['pasta', 'Flour']);
  });

  it('sorts alphabetically inside each group, so the list is stable', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Stew', ['onion', 'beef', 'carrot'])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['beef', 'carrot', 'onion']);
  });
});
