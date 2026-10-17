import { normalizeIngredientName, type MealPlanEntryDto } from '@recetapp/contracts';

import { isLowStock } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';

import { DEFAULT_SHOPPING_SOURCE, type ShoppingSource } from './shopping-source';

export type ShoppingListItem = {
  /** As the user typed it when it is theirs, as the model wrote it otherwise. */
  name: string;
  /** Dishes in the week that use it. Empty when the item is listed for running low. */
  neededFor: string[];
};

export type BuildShoppingListInput = {
  pantry: PantryEntry[];
  planEntries: MealPlanEntryDto[];
  preferences: PreferencesDto;
  /** What the list is built from. Defaults to the weekly menu. */
  source?: ShoppingSource;
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
  const needed = new Map<string, ShoppingListItem>();

  for (const planEntry of input.planEntries) {
    // A dish listing the same ingredient twice should not name itself twice.
    const seen = new Set<string>();

    for (const ingredient of planEntry.ingredients) {
      const key = normalizeIngredientName(ingredient);
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
      } else {
        needed.set(key, {
          name: owned ? owned.ingredient.displayName : ingredient,
          neededFor: [planEntry.dishTitle],
        });
      }
    }
  }

  return [...needed.values()].sort((a, b) => a.name.localeCompare(b.name));
}
