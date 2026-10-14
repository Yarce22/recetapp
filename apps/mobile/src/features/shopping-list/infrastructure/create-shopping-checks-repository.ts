import { getDatabase } from '@/shared/db/client';

import type { ShoppingChecksRepository } from '../domain/shopping-checks-repository';

import { SqliteShoppingChecksRepository } from './sqlite-shopping-checks-repository';
import { SyncedShoppingChecksRepository } from './synced-shopping-checks-repository';

/** Native storage: SQLite, wrapped so a household can share the ticks. */
export async function createShoppingChecksRepository(): Promise<ShoppingChecksRepository> {
  const db = await getDatabase();
  return new SyncedShoppingChecksRepository(new SqliteShoppingChecksRepository(db));
}
