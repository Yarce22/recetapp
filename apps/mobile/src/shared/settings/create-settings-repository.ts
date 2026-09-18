import { getDatabase } from '@/shared/db/client';

import type { SettingsRepository } from './settings-repository';
import { SqliteSettingsRepository } from './sqlite-settings-repository';

/** Native settings storage: the same SQLite database the pantry uses. */
export async function createSettingsRepository(): Promise<SettingsRepository> {
  const db = await getDatabase();
  return new SqliteSettingsRepository(db);
}
