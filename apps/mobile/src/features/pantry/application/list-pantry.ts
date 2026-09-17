import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';

/**
 * Lists the pantry, sorted by display name.
 *
 * Sorting here rather than in the screen keeps the order identical no matter
 * which adapter is behind the port, so the UI never has to compensate for a
 * repository that returns rows in insertion order.
 */
export function makeListPantry(repository: PantryRepository) {
  return async function listPantry(): Promise<PantryEntry[]> {
    const entries = await repository.findAll();
    return [...entries].sort((a, b) =>
      a.ingredient.displayName.localeCompare(b.ingredient.displayName),
    );
  };
}
