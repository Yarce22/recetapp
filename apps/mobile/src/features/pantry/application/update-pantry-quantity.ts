import { PantryItemNotFoundError } from '../domain/errors';
import type { IngredientId } from '../domain/ingredient';
import { createPantryItem } from '../domain/pantry-item';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';
import type { Quantity } from '../domain/quantity';

export type UpdatePantryQuantityInput = {
  ingredientId: IngredientId;
  quantity: Quantity;
};

/**
 * Sets the amount of an ingredient to an absolute value.
 *
 * This is the "I just looked in the cupboard" operation, so it replaces rather
 * than adds. Adding is what `addPantryItem` does.
 */
export function makeUpdatePantryQuantity(repository: PantryRepository) {
  return async function updatePantryQuantity(
    input: UpdatePantryQuantityInput,
  ): Promise<PantryEntry> {
    const existing = await repository.findByIngredientId(input.ingredientId);
    if (!existing) {
      throw new PantryItemNotFoundError(input.ingredientId);
    }

    // The stored threshold may be expressed in a unit the new quantity cannot
    // be compared with, so it is dropped rather than left silently broken.
    const threshold = existing.item.lowStockThreshold;
    const keepsThreshold = threshold !== null && threshold.unit === input.quantity.unit;

    const updated: PantryEntry = {
      ingredient: existing.ingredient,
      item: createPantryItem({
        ingredientId: input.ingredientId,
        quantity: input.quantity,
        lowStockThreshold: keepsThreshold ? threshold : null,
        expiresAt: existing.item.expiresAt,
      }),
    };

    await repository.save(updated);
    return updated;
  };
}
