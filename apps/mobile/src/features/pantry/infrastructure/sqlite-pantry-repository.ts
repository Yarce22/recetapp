import type { SQLiteDatabase } from 'expo-sqlite';

import type { IngredientId } from '../domain/ingredient';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';

import { entryToRow, rowToEntry, type PantryRow } from './pantry-mappers';

const SELECT_ALL = 'SELECT * FROM pantry_items';
const SELECT_ONE = 'SELECT * FROM pantry_items WHERE ingredient_id = ?';
const DELETE_ONE = 'DELETE FROM pantry_items WHERE ingredient_id = ?';

const UPSERT = `
  INSERT INTO pantry_items (
    ingredient_id, display_name, category, default_unit,
    amount, unit, threshold_amount, threshold_unit, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ingredient_id) DO UPDATE SET
    display_name     = excluded.display_name,
    category         = excluded.category,
    default_unit     = excluded.default_unit,
    amount           = excluded.amount,
    unit             = excluded.unit,
    threshold_amount = excluded.threshold_amount,
    threshold_unit   = excluded.threshold_unit,
    expires_at       = excluded.expires_at
`;

/**
 * SQLite adapter for the pantry port.
 *
 * Every statement is parameterized. Ingredient names come from user input and
 * are never interpolated into SQL.
 */
export class SqlitePantryRepository implements PantryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async findAll(): Promise<PantryEntry[]> {
    const rows = await this.db.getAllAsync<PantryRow>(SELECT_ALL);
    return rows.map(rowToEntry);
  }

  async findByIngredientId(id: IngredientId): Promise<PantryEntry | null> {
    const row = await this.db.getFirstAsync<PantryRow>(SELECT_ONE, [id]);
    return row ? rowToEntry(row) : null;
  }

  async save(entry: PantryEntry): Promise<void> {
    const row = entryToRow(entry);
    await this.db.runAsync(UPSERT, [
      row.ingredient_id,
      row.display_name,
      row.category,
      row.default_unit,
      row.amount,
      row.unit,
      row.threshold_amount,
      row.threshold_unit,
      row.expires_at,
    ]);
  }

  async remove(id: IngredientId): Promise<void> {
    await this.db.runAsync(DELETE_ONE, [id]);
  }
}
