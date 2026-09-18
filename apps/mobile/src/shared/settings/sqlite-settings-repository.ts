import type { SQLiteDatabase } from 'expo-sqlite';

import type { SettingsRepository } from './settings-repository';

const SELECT = 'SELECT value FROM settings WHERE key = ?';
const UPSERT =
  'INSERT INTO settings (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(SELECT, [key]);
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(UPSERT, [key, value]);
  }
}
