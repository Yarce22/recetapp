import type { SQLiteDatabase } from 'expo-sqlite';

import type { ShoppingCheck, ShoppingChecksRepository } from '../domain/shopping-checks-repository';

const UPSERT = `
  INSERT INTO shopping_checks (item_key, name) VALUES (?, ?)
  ON CONFLICT(item_key) DO UPDATE SET name = excluded.name
`;

/** SQLite adapter. Every statement is parameterized. */
export class SqliteShoppingChecksRepository implements ShoppingChecksRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async findAll(): Promise<ShoppingCheck[]> {
    const rows = await this.db.getAllAsync<{ item_key: string; name: string }>(
      'SELECT item_key, name FROM shopping_checks',
    );
    return rows.map((row) => ({ key: row.item_key, name: row.name }));
  }

  async check(item: ShoppingCheck): Promise<void> {
    await this.db.runAsync(UPSERT, [item.key, item.name]);
  }

  async uncheck(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM shopping_checks WHERE item_key = ?', [key]);
  }
}
