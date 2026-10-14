/**
 * The three kinds of record that are shared in a household.
 *
 * The names match both the local SQLite tables and the Supabase tables, so a
 * record is addressed the same way on the device, on the wire and on the server.
 * Per-device settings (the language, the device id) are deliberately absent.
 */
export const SYNC_ENTITY_NAMES = ['pantry_items', 'meal_plan_entries', 'shopping_items'] as const;

export type SyncEntityName = (typeof SYNC_ENTITY_NAMES)[number];

export type SyncEntityDescriptor = {
  /** Columns that identify a record inside one household. */
  keyColumns: readonly string[];
  /** Everything else that is synced. Null on a tombstone. */
  valueColumns: readonly string[];
};

export const SYNC_ENTITIES: Record<SyncEntityName, SyncEntityDescriptor> = {
  pantry_items: {
    keyColumns: ['ingredient_id'],
    valueColumns: [
      'display_name',
      'category',
      'default_unit',
      'amount',
      'unit',
      'threshold_amount',
      'threshold_unit',
      'expires_at',
    ],
  },
  meal_plan_entries: {
    keyColumns: ['date', 'slot'],
    valueColumns: ['dish_id', 'dish_title', 'summary', 'ingredients'],
  },
  // A row exists (not deleted) while the item is ticked. Un-ticking is a tombstone.
  shopping_items: {
    keyColumns: ['item_key'],
    valueColumns: ['name'],
  },
};

export function isSyncEntityName(value: unknown): value is SyncEntityName {
  return typeof value === 'string' && (SYNC_ENTITY_NAMES as readonly string[]).includes(value);
}

/**
 * Turns the key columns into one string usable as a map key and a SQLite key.
 *
 * JSON keeps parts that contain separators intact; a hand-rolled `a|b` join
 * would not.
 */
export function encodeKey(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

export function decodeKey(key: string): string[] {
  const parsed: unknown = JSON.parse(key);
  if (!Array.isArray(parsed) || !parsed.every((part) => typeof part === 'string')) {
    throw new Error(`Malformed sync key: ${key}`);
  }
  return parsed;
}

/** The key of a row, read from its key columns. Throws when one is missing. */
export function keyOfRow(entity: SyncEntityName, row: Record<string, unknown>): string {
  const parts = SYNC_ENTITIES[entity].keyColumns.map((column) => {
    const value = row[column];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Row of ${entity} lacks its key column "${column}".`);
    }
    return value;
  });
  return encodeKey(parts);
}

/** The inverse of `keyOfRow`: the key columns and their values. */
export function keyToColumns(entity: SyncEntityName, key: string): Record<string, string> {
  const columns = SYNC_ENTITIES[entity].keyColumns;
  const parts = decodeKey(key);
  if (parts.length !== columns.length) {
    throw new Error(`Key ${key} does not fit ${entity}: expected ${columns.length} parts.`);
  }
  return Object.fromEntries(columns.map((column, index) => [column, parts[index]]));
}

/**
 * The wire row that deletes a record. The value columns are sent as null so
 * the tombstone never carries stale data.
 */
export function tombstoneRow(entity: SyncEntityName, key: string): Record<string, unknown> {
  const nulls = Object.fromEntries(
    SYNC_ENTITIES[entity].valueColumns.map((column) => [column, null]),
  );
  return { ...keyToColumns(entity, key), ...nulls, deleted: true };
}

/** The wire row for a live record: key and value columns plus `deleted: false`. */
export function liveRow(
  entity: SyncEntityName,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const { keyColumns, valueColumns } = SYNC_ENTITIES[entity];
  const picked = Object.fromEntries(
    [...keyColumns, ...valueColumns].map((column) => [column, row[column] ?? null]),
  );
  return { ...picked, deleted: false };
}
