import type { SQLiteDatabase } from 'expo-sqlite';

import type { SyncEntityName } from './sync-entities';
import type { OutboxEntry, OutboxOp, RecordMeta, SyncStore } from './sync-store';

type OutboxRow = {
  entity: string;
  key: string;
  op: string;
  payload: string;
  rev: number;
};

const ENQUEUE = `
  INSERT INTO sync_outbox (entity, key, op, payload, rev)
  VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox))
  ON CONFLICT(entity, key) DO UPDATE SET
    op      = excluded.op,
    payload = excluded.payload,
    rev     = excluded.rev
`;

const SET_META = `
  INSERT INTO sync_meta (entity, key, updated_at, deleted) VALUES (?, ?, ?, ?)
  ON CONFLICT(entity, key) DO UPDATE SET
    updated_at = excluded.updated_at,
    deleted    = excluded.deleted
`;

const SET_STATE = `
  INSERT INTO sync_state (name, value) VALUES (?, ?)
  ON CONFLICT(name) DO UPDATE SET value = excluded.value
`;

/** SQLite adapter for the sync bookkeeping. Every statement is parameterized. */
export class SqliteSyncStore implements SyncStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async enqueue(
    entity: SyncEntityName,
    key: string,
    op: OutboxOp,
    row: Record<string, unknown>,
  ): Promise<void> {
    await this.db.runAsync(ENQUEUE, [entity, key, op, JSON.stringify(row)]);
  }

  async pending(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      'SELECT entity, key, op, payload, rev FROM sync_outbox ORDER BY rev LIMIT ?',
      [limit],
    );
    return rows.map((row) => ({
      entity: row.entity as SyncEntityName,
      key: row.key,
      op: row.op as OutboxOp,
      row: JSON.parse(row.payload) as Record<string, unknown>,
      rev: row.rev,
    }));
  }

  async pendingCount(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
    return row?.n ?? 0;
  }

  async isDirty(entity: SyncEntityName, key: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      'SELECT 1 AS n FROM sync_outbox WHERE entity = ? AND key = ?',
      [entity, key],
    );
    return row !== null;
  }

  async acknowledge(entity: SyncEntityName, key: string, rev: number): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND key = ? AND rev = ?', [
      entity,
      key,
      rev,
    ]);
  }

  async getMeta(entity: SyncEntityName, key: string): Promise<RecordMeta | null> {
    const row = await this.db.getFirstAsync<{ updated_at: string; deleted: number }>(
      'SELECT updated_at, deleted FROM sync_meta WHERE entity = ? AND key = ?',
      [entity, key],
    );
    return row ? { updatedAt: row.updated_at, deleted: row.deleted === 1 } : null;
  }

  async setMeta(entity: SyncEntityName, key: string, meta: RecordMeta): Promise<void> {
    await this.db.runAsync(SET_META, [entity, key, meta.updatedAt, meta.deleted ? 1 : 0]);
  }

  async getState(name: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_state WHERE name = ?',
      [name],
    );
    return row ? row.value : null;
  }

  async setState(name: string, value: string | null): Promise<void> {
    if (value === null) {
      await this.db.runAsync('DELETE FROM sync_state WHERE name = ?', [name]);
      return;
    }
    await this.db.runAsync(SET_STATE, [name, value]);
  }

  async reset(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM sync_outbox');
      await this.db.runAsync('DELETE FROM sync_meta');
      await this.db.runAsync('DELETE FROM sync_state');
    });
  }
}
