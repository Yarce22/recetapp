import type { ShoppingChecksRepository } from '../domain/shopping-checks-repository';

import { InMemoryShoppingChecksRepository } from './in-memory-shopping-checks-repository';

/** Web storage: in memory, like the rest of the web build. */
export async function createShoppingChecksRepository(): Promise<ShoppingChecksRepository> {
  return new InMemoryShoppingChecksRepository();
}
