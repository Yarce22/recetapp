import { getDatabase } from '@/shared/db/client';

import type { PantryRepository } from '../domain/pantry-repository';

import { SqlitePantryRepository } from './sqlite-pantry-repository';
import { SyncedPantryRepository } from './synced-pantry-repository';

/**
 * Builds the pantry repository for native platforms: SQLite on the device.
 *
 * The web build resolves `create-pantry-repository.web.ts` instead, which is
 * what keeps expo-sqlite out of the web bundle entirely.
 */
export async function createPantryRepository(): Promise<PantryRepository> {
  const db = await getDatabase();
  // The decorator is a pass-through until the device joins a household.
  return new SyncedPantryRepository(new SqlitePantryRepository(db));
}
