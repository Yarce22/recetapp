import { normalizeIngredientName, type MealPlanEntryDto } from '@recetapp/contracts';

import { isLowStock } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';

export type ShoppingReason = 'low-stock' | 'missing-for-plan';

export type ShoppingListItem = {
  /** As the user typed it when it is theirs, as the model wrote it otherwise. */
  name: string;
  reasons: ShoppingReason[];
  /** Dishes in the week that use it. Empty when nothing planned needs it. */
  neededFor: string[];
};

export type BuildShoppingListInput = {
  pantry: PantryEntry[];
  planEntries: MealPlanEntryDto[];
  preferences: PreferencesDto;
};

type Draft = {
  name: string;
  reasons: Set<ShoppingReason>;
  neededFor: string[];
};

/**
 * Works out what to buy.
 *
 * Two independent reasons, and an ingredient can carry both:
 *
 * - it is registered in the pantry and has reached its low-stock threshold
 * - the week's menu needs it and the pantry cannot cover it
 *
 * Derived on demand and never stored: the pantry and the plan are the truth,
 * and a saved list would start drifting from them the moment either changed.
 *
 * Purely local. The ingredients each dish needs were kept on the plan entry
 * when the week was built, precisely so this does not cost a model call.
 */
export function buildShoppingList(input: BuildShoppingListInput): ShoppingListItem[] {
  const drafts = new Map<string, Draft>();

  const draftFor = (key: string, name: string): Draft => {
    const existing = drafts.get(key);
    if (existing) return existing;

    const created: Draft = { name, reasons: new Set(), neededFor: [] };
    drafts.set(key, created);
    return created;
  };

  const pantryByKey = new Map(
    input.pantry.map((entry) => [normalizeIngredientName(entry.ingredient.name), entry]),
  );
  const staples = new Set(input.preferences.staples.map(normalizeIngredientName));

  for (const entry of input.pantry) {
    if (!isLowStock(entry.item)) continue;

    const key = normalizeIngredientName(entry.ingredient.name);
    draftFor(key, entry.ingredient.displayName).reasons.add('low-stock');
  }

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
      const draft = draftFor(key, owned ? owned.ingredient.displayName : ingredient);

      // Knowing which dishes need it is what turns a list of words into a
      // list you can decide from in a shop.
      draft.neededFor.push(planEntry.dishTitle);

      if (!owned) draft.reasons.add('missing-for-plan');
    }
  }

  return [...drafts.values()]
    .filter((draft) => draft.reasons.size > 0)
    .map((draft) => ({
      name: draft.name,
      reasons: [...draft.reasons],
      neededFor: draft.neededFor,
    }))
    .sort((a, b) => {
      // What the week is missing comes first: without it a planned meal
      // cannot be cooked at all, while a low stock item merely runs out soon.
      const aBlocking = a.reasons.includes('missing-for-plan') ? 0 : 1;
      const bBlocking = b.reasons.includes('missing-for-plan') ? 0 : 1;
      if (aBlocking !== bBlocking) return aBlocking - bBlocking;
      return a.name.localeCompare(b.name);
    });
}
