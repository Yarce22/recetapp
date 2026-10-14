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
  {
    version: 2,
    statements: [
      // Small key/value store for things that are settings rather than data:
      // preferences and the anonymous device identifier the BFF rate-limits on.
      `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    statements: [
      // One row per day and meal. The date is stored as YYYY-MM-DD text
      // rather than an instant: "Tuesday's dinner" is a calendar fact, and a
      // timestamp would shift it across timezones.
      `CREATE TABLE IF NOT EXISTS meal_plan_entries (
        date       TEXT NOT NULL,
        slot       TEXT NOT NULL,
        dish_id    TEXT NOT NULL,
        dish_title TEXT NOT NULL,
        summary    TEXT NOT NULL,
        PRIMARY KEY (date, slot)
      )`,
    ],
  },
  {
    version: 4,
    statements: [
      // The ingredients each planned dish needs, as a JSON array of names.
      // Stored so the shopping list is a local computation instead of one
      // model call per dish in the week.
      //
      // Added as a separate migration rather than edited into version 3:
      // installs that already ran 3 would never see the column otherwise.
      `ALTER TABLE meal_plan_entries ADD COLUMN ingredients TEXT NOT NULL DEFAULT '[]'`,
    ],
  },
  {
    version: 5,
    statements: [
      // Shopping list ticks. The list itself is derived from the pantry and the
      // plan; only the ticked items are stored, so a household can share them.
      // item_key is the normalized ingredient name.
      `CREATE TABLE IF NOT EXISTS shopping_checks (
        item_key TEXT PRIMARY KEY NOT NULL,
        name     TEXT NOT NULL
      )`,
      // Sharing bookkeeping. All three stay empty (and cost nothing) in solo
      // mode. The outbox holds at most one pending change per record.
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        entity  TEXT NOT NULL,
        key     TEXT NOT NULL,
        op      TEXT NOT NULL,
        payload TEXT NOT NULL,
        rev     INTEGER NOT NULL,
        PRIMARY KEY (entity, key)
      )`,
      // The last server version of each record merged into this device.
      `CREATE TABLE IF NOT EXISTS sync_meta (
        entity     TEXT NOT NULL,
        key        TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted    INTEGER NOT NULL,
        PRIMARY KEY (entity, key)
      )`,
      // Pull cursors and one-off flags.
      `CREATE TABLE IF NOT EXISTS sync_state (
        name  TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
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
