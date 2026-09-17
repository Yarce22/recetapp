import type { IngredientCategory } from '../domain/ingredient';
import { createIngredient, normalizeIngredientName } from '../domain/ingredient';
import { createPantryItem } from '../domain/pantry-item';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';
import { addQuantities, type Quantity } from '../domain/quantity';

export type AddPantryItemInput = {
  name: string;
  category: IngredientCategory;
  quantity: Quantity;
  lowStockThreshold: Quantity | null;
  expiresAt?: Date | null;
};

/**
 * Adds food to the pantry.
 *
 * When the ingredient is already there, the amounts are added together rather
 * than a second row being created. Buying more tomatoes gives you more
 * tomatoes, not a duplicate entry.
 *
 * The ingredient id is the normalized name, which is what makes that merge
 * work across spellings: "Limón" and "limon" resolve to the same id.
 */
export function makeAddPantryItem(repository: PantryRepository) {
  return async function addPantryItem(input: AddPantryItemInput): Promise<PantryEntry> {
    const id = normalizeIngredientName(input.name);
    const existing = await repository.findByIngredientId(id);

    if (existing) {
      const merged: PantryEntry = {
        ingredient: existing.ingredient,
        item: createPantryItem({
          ingredientId: id,
          quantity: addQuantities(existing.item.quantity, input.quantity),
          lowStockThreshold: input.lowStockThreshold ?? existing.item.lowStockThreshold,
          expiresAt: input.expiresAt ?? existing.item.expiresAt,
        }),
      };
      await repository.save(merged);
      return merged;
    }

    const entry: PantryEntry = {
      ingredient: createIngredient({
        id,
        name: input.name,
        category: input.category,
        defaultUnit: input.quantity.unit,
      }),
      item: createPantryItem({
        ingredientId: id,
        quantity: input.quantity,
        lowStockThreshold: input.lowStockThreshold,
        expiresAt: input.expiresAt ?? null,
      }),
    };

    await repository.save(entry);
    return entry;
  };
}
