/**
 * Minimal surface of a SQLite database needed to migrate it.
 *
 * Narrower than SQLiteDatabase on purpose: the runner can then be tested with
 * a plain fake, without pulling the native module into the test environment.
 */
export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export type Migration = {
  /** Strictly increasing. Never renumber a migration that has shipped. */
  version: number;
  statements: string[];
};

/**
 * Schema history.
 *
 * Migrations are append-only: once a version has been released, editing it
 * leaves existing installs on a schema that no longer matches the code.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS pantry_items (
        ingredient_id    TEXT PRIMARY KEY NOT NULL,
        display_name     TEXT NOT NULL,
        category         TEXT NOT NULL,
        default_unit     TEXT NOT NULL,
        amount           REAL NOT NULL,
        unit             TEXT NOT NULL,
        threshold_amount REAL,
        threshold_unit   TEXT,
        expires_at       INTEGER
      )`,
    ],
  },
];

/**
 * Brings the database up to the latest schema version.
 *
 * Uses SQLite's own `user_version` pragma as the bookkeeping, so no extra
 * table is needed and the version travels with the database file.
 */
export async function runMigrations(
  db: MigrationDb,
  migrations: Migration[] = MIGRATIONS,
): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((migration) => migration.version > current);

  for (const migration of pending) {
    for (const statement of migration.statements) {
      await db.execAsync(statement);
    }
    // Pragmas cannot be parameterized, and the value is a number from our own
    // append-only list rather than anything user-supplied.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
