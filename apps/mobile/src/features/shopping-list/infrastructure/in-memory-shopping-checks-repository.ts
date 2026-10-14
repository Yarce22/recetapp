import type { ShoppingCheck, ShoppingChecksRepository } from '../domain/shopping-checks-repository';

/** In-memory adapter, used by the web build and by tests. */
export class InMemoryShoppingChecksRepository implements ShoppingChecksRepository {
  private readonly checks = new Map<string, ShoppingCheck>();

  async findAll(): Promise<ShoppingCheck[]> {
    return [...this.checks.values()];
  }

  async check(item: ShoppingCheck): Promise<void> {
    this.checks.set(item.key, item);
  }

  async uncheck(key: string): Promise<void> {
    this.checks.delete(key);
  }
}
