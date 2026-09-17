import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

const DATABASE_NAME = 'recetapp.db';

let instance: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the database and brings its schema up to date.
 *
 * The promise is cached rather than the resolved database, so concurrent
 * callers during startup share one open + migrate cycle instead of racing.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  instance ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db);
    return db;
  })();

  return instance;
}

/** Test seam: drops the cached connection so the next call reopens. */
export function resetDatabaseForTests(): void {
  instance = null;
}
