import { normalizeIngredientName } from '../domain/ingredient';
import type { PantryRepository } from '../domain/pantry-repository';
import { canConvert } from '../domain/units';
import { createPantryItem } from '../domain/pantry-item';
import { subtractQuantities, type Quantity } from '../domain/quantity';

export type CookedIngredient = {
  name: string;
  quantity: Quantity;
};

export type CookRecipeInput = {
  ingredients: CookedIngredient[];
};

export type SkipReason = 'not-in-pantry' | 'incompatible-units';

export type CookRecipeResult = {
  deducted: CookedIngredient[];
  skipped: { name: string; reason: SkipReason }[];
};

/**
 * Takes what a cooked recipe used out of the pantry.
 *
 * Best effort by design. A recipe is written by a model and the pantry by a
 * person, so names and units will not always line up. An ingredient that cannot
 * be matched or compared is reported and left alone rather than aborting the
 * whole meal: guessing a conversion would corrupt the stock.
 *
 * Amounts clamp at zero and the item stays, so its low-stock threshold can
 * still put it on the shopping list.
 */
export function makeCookRecipe(repository: PantryRepository) {
  return async function cookRecipe(input: CookRecipeInput): Promise<CookRecipeResult> {
    const entries = await repository.findAll();
    const idByName = new Map(entries.map((entry) => [entry.ingredient.name, entry.ingredient.id]));

    const result: CookRecipeResult = { deducted: [], skipped: [] };

    // Sequential on purpose: a recipe listing one ingredient twice must see the
    // stock left by the first line, so each line reads fresh state.
    for (const used of input.ingredients) {
      const id = idByName.get(normalizeIngredientName(used.name));
      const current = id ? await repository.findByIngredientId(id) : null;

      if (!current) {
        result.skipped.push({ name: used.name, reason: 'not-in-pantry' });
        continue;
      }
      if (!canConvert(used.quantity.unit, current.item.quantity.unit)) {
        result.skipped.push({ name: used.name, reason: 'incompatible-units' });
        continue;
      }

      await repository.save({
        ingredient: current.ingredient,
        item: createPantryItem({
          ingredientId: current.item.ingredientId,
          quantity: subtractQuantities(current.item.quantity, used.quantity),
          lowStockThreshold: current.item.lowStockThreshold,
          expiresAt: current.item.expiresAt,
        }),
      });
      result.deducted.push({ name: used.name, quantity: used.quantity });
    }

    return result;
  };
}
