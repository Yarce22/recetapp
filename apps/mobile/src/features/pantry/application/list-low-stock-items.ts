import { isLowStock } from '../domain/pantry-item';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';

import { makeListPantry } from './list-pantry';

/** Lists only the items that have reached their low-stock threshold. */
export function makeListLowStockItems(repository: PantryRepository) {
  const listPantry = makeListPantry(repository);

  return async function listLowStockItems(): Promise<PantryEntry[]> {
    const entries = await listPantry();
    return entries.filter((entry) => isLowStock(entry.item));
  };
}
