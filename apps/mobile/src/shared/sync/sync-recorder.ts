import type { Mutex } from './mutex';
import { liveRow, tombstoneRow, type SyncEntityName } from './sync-entities';
import type { OutboxOp, SyncStore } from './sync-store';

export type RecordedChange = {
  entity: SyncEntityName;
  key: string;
  op: OutboxOp;
  /** Wire row for an upsert; ignored for a delete. */
  row?: Record<string, unknown>;
};

/**
 * What the synced repository decorators call around every local write.
 *
 * In solo mode this is a pass-through. In a household it runs the write and
 * queues the change as one step with respect to the sync engine.
 */
export interface SyncRecorder {
  record(write: () => Promise<void>, changes: RecordedChange[]): Promise<void>;
}

/** Solo mode: no queue, no lock, the write runs exactly as it always did. */
export const soloRecorder: SyncRecorder = {
  record: (write) => write(),
};

export type SyncRecorderDeps = {
  store: SyncStore;
  lock: Mutex;
  /** True while the device is in a household. */
  isActive: () => boolean;
  /** Called after changes were queued, so the engine can schedule a push. */
  onQueued: () => void;
};

export function createSyncRecorder(deps: SyncRecorderDeps): SyncRecorder {
  return {
    async record(write, changes) {
      if (!deps.isActive()) {
        await write();
        return;
      }

      await deps.lock.run(async () => {
        await write();
        for (const change of changes) {
          const row =
            change.op === 'delete'
              ? tombstoneRow(change.entity, change.key)
              : liveRow(change.entity, change.row ?? {});
          await deps.store.enqueue(change.entity, change.key, change.op, row);
        }
      });

      // Fire and forget: the UI never waits for the network.
      if (changes.length > 0) deps.onQueued();
    },
  };
}

let current: SyncRecorder = soloRecorder;

/** The recorder the decorated repositories use. Looked up on every write. */
export function getSyncRecorder(): SyncRecorder {
  return current;
}

export function setSyncRecorder(recorder: SyncRecorder): void {
  current = recorder;
}
