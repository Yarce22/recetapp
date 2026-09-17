import type { IngredientId } from '../domain/ingredient';
import type { PantryRepository } from '../domain/pantry-repository';

export type RemovePantryItemInput = {
  ingredientId: IngredientId;
};

export function makeRemovePantryItem(repository: PantryRepository) {
  return async function removePantryItem(input: RemovePantryItemInput): Promise<void> {
    await repository.remove(input.ingredientId);
  };
}
