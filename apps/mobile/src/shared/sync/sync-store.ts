import type { SyncEntityName } from './sync-entities';

export type OutboxOp = 'upsert' | 'delete';

/** One queued change. At most one per record: a newer change replaces the older. */
export type OutboxEntry = {
  entity: SyncEntityName;
  key: string;
  op: OutboxOp;
  /** The full wire row to push (a tombstone row for a delete). */
  row: Record<string, unknown>;
  /** Grows with every replacement, so an acknowledgement can tell it is stale. */
  rev: number;
};

/** The last server version of a record that this device has merged. */
export type RecordMeta = {
  updatedAt: string;
  deleted: boolean;
};

/**
 * Port for the local bookkeeping the sync engine needs: the outbox, the last
 * merged version of each record, and a few cursors and flags.
 *
 * It lives in the same SQLite database as the data, so a queued change survives
 * the app being killed.
 */
export interface SyncStore {
  /** Queues a change, replacing any queued change for the same record. */
  enqueue(
    entity: SyncEntityName,
    key: string,
    op: OutboxOp,
    row: Record<string, unknown>,
  ): Promise<void>;
  /** Oldest queued changes first. */
  pending(limit: number): Promise<OutboxEntry[]>;
  pendingCount(): Promise<number>;
  /** True while a change for the record is queued. */
  isDirty(entity: SyncEntityName, key: string): Promise<boolean>;
  /** Removes the queued change only if it is still the revision that was pushed. */
  acknowledge(entity: SyncEntityName, key: string, rev: number): Promise<void>;

  getMeta(entity: SyncEntityName, key: string): Promise<RecordMeta | null>;
  setMeta(entity: SyncEntityName, key: string, meta: RecordMeta): Promise<void>;

  getState(name: string): Promise<string | null>;
  /** A null value removes the entry. */
  setState(name: string, value: string | null): Promise<void>;

  /** Forgets everything: outbox, versions and cursors. Used on join and leave. */
  reset(): Promise<void>;
}
