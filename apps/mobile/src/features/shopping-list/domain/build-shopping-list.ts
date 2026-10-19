import {
  normalizeIngredientName,
  type MealPlanEntryDto,
  type Quantity,
} from '@recetapp/contracts';

import { PLAN_SERVINGS } from '@/features/meal-plan/domain/plan-servings';

import { isLowStock } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';

import { DEFAULT_SHOPPING_SOURCE, type ShoppingSource } from './shopping-source';

export type ShoppingListItem = {
  /** As the user typed it when it is theirs, as the model wrote it otherwise. */
  name: string;
  /** Dishes in the week that use it. Empty when the item is listed for running low. */
  neededFor: string[];
  /**
   * How much to buy, summed per unit. Absent when the menu only named the
   * ingredient: units are never converted, so two units stay two amounts.
   */
  quantities?: Quantity[];
};

export type BuildShoppingListInput = {
  pantry: PantryEntry[];
  planEntries: MealPlanEntryDto[];
  preferences: PreferencesDto;
  /** What the list is built from. Defaults to the weekly menu. */
  source?: ShoppingSource;
  /** Servings the stored per-serving amounts are multiplied by. */
  servings?: number;
};

/**
 * Works out what to buy, from whichever source the user chose.
 *
 * Derived on demand and never stored: the pantry and the plan are the truth,
 * and a saved list would start drifting from them the moment either changed.
 */
export function buildShoppingList(input: BuildShoppingListInput): ShoppingListItem[] {
  const source = input.source ?? DEFAULT_SHOPPING_SOURCE;
  return source === 'low-stock' ? buildLowStockList(input) : buildMenuList(input);
}

/**
 * The pantry items that reached their low-stock threshold.
 *
 * An item without a threshold never appears: setting one is how the user opts
 * an ingredient in, and nobody asked to be warned about the rest.
 */
function buildLowStockList({ pantry }: BuildShoppingListInput): ShoppingListItem[] {
  return pantry
    .filter((entry) => isLowStock(entry.item))
    .map((entry) => ({ name: entry.ingredient.displayName, neededFor: [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What is missing to cook the week's menu.
 *
 * An ingredient the menu needs is listed when the pantry does not hold it, or
 * holds it but has reached its low-stock threshold. Anything the menu does not
 * use stays out, however empty the pantry is: this list answers "what do I buy
 * to make this week", not "what is running out".
 *
 * Purely local. The ingredients each dish needs were kept on the plan entry
 * when the week was built, precisely so this does not cost a model call.
 */
function buildMenuList(input: BuildShoppingListInput): ShoppingListItem[] {
  const pantryByKey = new Map(
    input.pantry.map((entry) => [normalizeIngredientName(entry.ingredient.name), entry]),
  );
  const staples = new Set(input.preferences.staples.map(normalizeIngredientName));
  const servings = input.servings ?? PLAN_SERVINGS;
  const needed = new Map<string, ShoppingListItem>();

  for (const planEntry of input.planEntries) {
    // A dish listing the same ingredient twice should not name itself twice.
    const seen = new Set<string>();

    for (const { name, quantity } of plannedLines(planEntry, servings)) {
      const key = normalizeIngredientName(name);
      if (seen.has(key)) continue;
      seen.add(key);

      // Staples are assumed available; that assumption is the whole reason
      // strict mode is usable, so it has to hold here too.
      if (staples.has(key)) continue;

      const owned = pantryByKey.get(key);
      if (owned && !isLowStock(owned.item)) continue;

      // Knowing which dishes need it is what turns a list of words into a
      // list you can decide from in a shop.
      const existing = needed.get(key);
      if (existing) {
        existing.neededFor.push(planEntry.dishTitle);
        if (quantity) existing.quantities = addQuantity(existing.quantities ?? [], quantity);
      } else {
        needed.set(key, {
          name: owned ? owned.ingredient.displayName : name,
          neededFor: [planEntry.dishTitle],
          ...(quantity ? { quantities: [quantity] } : {}),
        });
      }
    }
  }

  return [...needed.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What a planned dish asks for.
 *
 * Prefers the amounts stored with the entry. They are per serving, so they are
 * multiplied here, and optional ones are dropped: nobody needs a trip to the
 * shop for a garnish. Entries planned without amounts fall back to the names.
 */
function plannedLines(
  entry: MealPlanEntryDto,
  servings: number,
): { name: string; quantity?: Quantity }[] {
  if (!entry.recipeIngredients) return entry.ingredients.map((name) => ({ name }));

  return entry.recipeIngredients
    .filter((ingredient) => !ingredient.optional)
    .map((ingredient) => ({
      name: ingredient.name,
      quantity: {
        amount: Number((ingredient.quantity.amount * servings).toFixed(2)),
        unit: ingredient.quantity.unit,
      },
    }));
}

/** Adds to the amount of the same unit, or keeps it apart when there is none. */
function addQuantity(quantities: Quantity[], added: Quantity): Quantity[] {
  const same = quantities.find((quantity) => quantity.unit === added.unit);
  if (!same) return [...quantities, added];
  return quantities.map((quantity) =>
    quantity === same
      ? { unit: quantity.unit, amount: Number((quantity.amount + added.amount).toFixed(2)) }
      : quantity,
  );
}
