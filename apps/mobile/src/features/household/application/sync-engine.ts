import type { Mutex } from '@/shared/sync/mutex';
import { SYNC_ENTITY_NAMES, keyOfRow, type SyncEntityName } from '@/shared/sync/sync-entities';
import type { OutboxEntry, SyncStore } from '@/shared/sync/sync-store';

import { backoffDelayMs } from '../domain/backoff';
import { SharingError, type SharingErrorKind } from '../domain/household';
import { decideMerge, isNewerThanMeta, toMicros } from '../domain/merge';
import type { EntityStore, RemoteRow, SyncBackend } from '../domain/ports';
import { IDLE_STATUS, type SyncStatus } from '../domain/sync-status';

/** Flag set when the device should queue its pre-existing local records after the first pull. */
export const PENDING_UPLOAD_FLAG = 'pending-upload';

const PAGE_SIZE = 500;
const PUSH_BATCH = 50;
/** Pulls re-read this much history; merging is idempotent, so overlap is free safety. */
const PULL_OVERLAP_MS = 10_000;
const LOCAL_CHANGE_DEBOUNCE_MS = 400;

export type Scheduler = (task: () => void, delayMs: number) => () => void;

const defaultScheduler: Scheduler = (task, delayMs) => {
  const handle = setTimeout(task, delayMs);
  return () => clearTimeout(handle);
};

export type SyncEngineDeps = {
  backend: SyncBackend;
  store: SyncStore;
  stores: Record<SyncEntityName, EntityStore>;
  /** Shared with the recorder so local writes and remote merges never interleave. */
  lock: Mutex;
  scheduler?: Scheduler;
  random?: () => number;
  now?: () => Date;
  /** Called once when the server says this identity is not allowed to write. */
  onForbidden?: () => void;
};

export interface SyncEngine {
  /** Starts syncing the household: live updates plus a first cycle. */
  start(householdId: string): void;
  /** Stops syncing and waits for the running cycle to finish. Queued changes stay queued. */
  stop(): Promise<void>;
  /** A local write was queued. Schedules a push; never blocks. */
  notifyLocalChange(): void;
  /** Runs a pull-then-push cycle now. Resolves when it is done and never rejects. */
  syncNow(): Promise<void>;
  /** The app came to the foreground: catch up and make sure live updates are connected. */
  onForeground(): void;
  /** Local tables were replaced outside the engine (join with discard, leave with discard). */
  notifyDataReplaced(): void;
  getStatus(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
}

class Stopped extends Error {}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { backend, store, stores, lock } = deps;
  const schedule = deps.scheduler ?? defaultScheduler;
  const random = deps.random ?? Math.random;
  const now = deps.now ?? (() => new Date());

  let householdId: string | null = null;
  let generation = 0;
  let status: SyncStatus = IDLE_STATUS;
  const listeners = new Set<(status: SyncStatus) => void>();

  let inflight: Promise<void> | null = null;
  let runAgain = false;
  let attempt = 0;
  let authRetried = false;
  let forbiddenReported = false;
  let cancelRetry: (() => void) | null = null;
  let cancelDebounce: (() => void) | null = null;
  let unsubscribeRealtime: (() => void) | null = null;

  function setStatus(patch: Partial<SyncStatus>): void {
    status = { ...status, ...patch };
    for (const listener of [...listeners]) listener(status);
  }

  function assertCurrent(gen: number): void {
    if (gen !== generation || householdId === null) throw new Stopped();
  }

  async function refreshPending(): Promise<void> {
    const pending = await store.pendingCount();
    setStatus({ pending });
  }

  /** Merges one remote row into the local tables. Returns true when local data changed. */
  async function mergeRemoteRow(entity: SyncEntityName, row: RemoteRow): Promise<boolean> {
    let key: string;
    try {
      key = keyOfRow(entity, row);
    } catch {
      return false; // Not a row we can place. Ignore rather than poison the sync.
    }
    const updatedAt = row.updated_at;
    if (typeof updatedAt !== 'string') return false;
    const remote = { updatedAt, deleted: row.deleted === true };

    return lock.run(async () => {
      const [dirty, meta] = await Promise.all([
        store.isDirty(entity, key),
        store.getMeta(entity, key),
      ]);
      const decision = decideMerge(remote, { dirty, meta });
      let applied = decision !== 'ignore';

      if (decision === 'apply') {
        try {
          await stores[entity].upsert(row);
        } catch {
          // The server sent something this build cannot store. Remember the
          // version so it is not retried forever; a later valid one will apply.
          applied = false;
        }
      } else if (decision === 'delete') {
        await stores[entity].remove(key);
      }

      // A dirty record keeps its old version: our push will replace it.
      if (!dirty && isNewerThanMeta(remote, meta)) await store.setMeta(entity, key, remote);
      return applied;
    });
  }

  async function pullEntity(entity: SyncEntityName, hid: string, gen: number): Promise<boolean> {
    const cursorName = `cursor:${hid}:${entity}`;
    const cursor = await store.getState(cursorName);
    let since: string | null = cursor
      ? new Date(Math.floor(toMicros(cursor) / 1000) - PULL_OVERLAP_MS).toISOString()
      : null;
    let newest = cursor;
    let changed = false;

    for (;;) {
      const rows = await backend.fetchRows(entity, hid, since, PAGE_SIZE);
      assertCurrent(gen);

      for (const row of rows) {
        if (await mergeRemoteRow(entity, row)) changed = true;
        const at = row.updated_at;
        if (typeof at === 'string' && (newest === null || toMicros(at) > toMicros(newest))) {
          newest = at;
        }
      }
      if (newest !== null) await store.setState(cursorName, newest);

      if (rows.length < PAGE_SIZE) break;
      const last = rows[rows.length - 1].updated_at;
      if (typeof last !== 'string' || last === since) break;
      since = last;
    }

    return changed;
  }

  async function pull(hid: string, gen: number): Promise<void> {
    let changed = false;
    for (const entity of SYNC_ENTITY_NAMES) {
      if (await pullEntity(entity, hid, gen)) changed = true;
    }
    if (changed) setStatus({ remoteRevision: status.remoteRevision + 1 });
  }

  /**
   * After the first pull of a join or create: queue every local record the
   * household has never heard of. Records the household already had were
   * overwritten by the pull, so on a collision the household's version wins.
   */
  async function queueLocalRecordsIfRequested(hid: string, gen: number): Promise<void> {
    const flag = `${PENDING_UPLOAD_FLAG}:${hid}`;
    if ((await store.getState(flag)) === null) return;

    for (const entity of SYNC_ENTITY_NAMES) {
      const rows = await stores[entity].readAll();
      for (const row of rows) {
        const key = keyOfRow(entity, row);
        await lock.run(async () => {
          const [dirty, meta] = await Promise.all([
            store.isDirty(entity, key),
            store.getMeta(entity, key),
          ]);
          if (dirty || meta !== null) return;
          await store.enqueue(entity, key, 'upsert', { ...row, deleted: false });
        });
        assertCurrent(gen);
      }
    }
    await store.setState(flag, null);
  }

  async function acknowledge(entry: OutboxEntry, stored: RemoteRow | undefined): Promise<void> {
    await lock.run(async () => {
      await store.acknowledge(entry.entity, entry.key, entry.rev);
      const updatedAt = stored?.updated_at;
      if (typeof updatedAt !== 'string') return;

      const version = { updatedAt, deleted: stored?.deleted === true };
      const meta = await store.getMeta(entry.entity, entry.key);
      if (isNewerThanMeta(version, meta)) await store.setMeta(entry.entity, entry.key, version);
    });
  }

  function storedFor(entry: OutboxEntry, stored: RemoteRow[]): RemoteRow | undefined {
    return stored.find((row) => {
      try {
        return keyOfRow(entry.entity, row) === entry.key;
      } catch {
        return false;
      }
    });
  }

  async function pushGroup(
    hid: string,
    entity: SyncEntityName,
    entries: OutboxEntry[],
  ): Promise<void> {
    try {
      const stored = await backend.pushRows(
        entity,
        hid,
        entries.map((entry) => entry.row),
      );
      for (const entry of entries) await acknowledge(entry, storedFor(entry, stored));
    } catch (error) {
      if (!(error instanceof SharingError) || error.kind !== 'rejected') throw error;

      if (entries.length === 1) {
        // A record the server refuses for good. Drop it so it cannot block
        // everything queued behind it.
        await acknowledge(entries[0], undefined);
        setStatus({ rejected: status.rejected + 1 });
        return;
      }
      // One bad record spoils a batch; find it by pushing them one by one.
      for (const entry of entries) await pushGroup(hid, entity, [entry]);
    }
  }

  async function push(hid: string, gen: number): Promise<void> {
    for (;;) {
      const entries = await store.pending(PUSH_BATCH);
      if (entries.length === 0) return;

      for (const entity of SYNC_ENTITY_NAMES) {
        const group = entries.filter((entry) => entry.entity === entity);
        if (group.length === 0) continue;
        await pushGroup(hid, entity, group);
        assertCurrent(gen);
      }
      await refreshPending();
    }
  }

  function scheduleRetry(): void {
    cancelRetry?.();
    attempt += 1;
    cancelRetry = schedule(
      () => {
        cancelRetry = null;
        void syncNow();
      },
      backoffDelayMs(attempt, random),
    );
  }

  async function handleFailure(error: unknown): Promise<void> {
    if (error instanceof Stopped) return;

    const kind: SharingErrorKind = error instanceof SharingError ? error.kind : 'server';

    if (kind === 'auth' && !authRetried) {
      authRetried = true;
      try {
        await backend.refreshSession();
        runAgain = true;
        return;
      } catch (refreshError) {
        return handleFailure(refreshError);
      }
    }

    await refreshPending().catch(() => undefined);
    setStatus({ state: kind === 'offline' ? 'offline' : 'error', error: kind });

    if (kind === 'forbidden' && !forbiddenReported) {
      forbiddenReported = true;
      deps.onForbidden?.();
    }
    scheduleRetry();
  }

  async function runOnce(): Promise<void> {
    const hid = householdId;
    if (hid === null) return;
    const gen = generation;

    setStatus({ state: 'syncing' });
    try {
      await pull(hid, gen);
      await queueLocalRecordsIfRequested(hid, gen);
      await push(hid, gen);
      assertCurrent(gen);

      attempt = 0;
      authRetried = false;
      forbiddenReported = false;
      await refreshPending();
      setStatus({ state: 'synced', error: null, lastSyncedAt: now().toISOString() });
    } catch (error) {
      await handleFailure(error);
    }
  }

  function syncNow(): Promise<void> {
    if (householdId === null) return Promise.resolve();
    if (inflight) {
      runAgain = true;
      return inflight;
    }

    // This run covers whatever either timer was waiting to do.
    cancelRetry?.();
    cancelRetry = null;
    cancelDebounce?.();
    cancelDebounce = null;
    inflight = (async () => {
      do {
        runAgain = false;
        await runOnce();
      } while (runAgain && householdId !== null);
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function subscribeRealtime(hid: string): void {
    unsubscribeRealtime?.();
    let dropped = false;
    unsubscribeRealtime = backend.subscribe(hid, {
      onRow(entity, row) {
        void mergeRemoteRow(entity, row)
          .then((changed) => {
            if (changed && householdId === hid) {
              setStatus({ remoteRevision: status.remoteRevision + 1 });
            }
          })
          .catch(() => undefined);
      },
      onConnection(connected) {
        setStatus({ realtimeConnected: connected });
        if (!connected) {
          dropped = true;
          return;
        }
        // Anything that happened while the channel was down is caught up by a pull.
        if (dropped && householdId === hid) {
          dropped = false;
          void syncNow();
        }
      },
    });
  }

  return {
    start(hid) {
      if (householdId === hid) return;
      householdId = hid;
      generation += 1;
      attempt = 0;
      authRetried = false;
      forbiddenReported = false;
      setStatus({ ...IDLE_STATUS, state: 'syncing', remoteRevision: status.remoteRevision });
      backend.setForeground(true);
      subscribeRealtime(hid);
      void refreshPending();
      void syncNow();
    },

    async stop() {
      householdId = null;
      generation += 1;
      cancelRetry?.();
      cancelDebounce?.();
      cancelRetry = null;
      cancelDebounce = null;
      unsubscribeRealtime?.();
      unsubscribeRealtime = null;
      backend.setForeground(false);
      await inflight;
      setStatus({ ...IDLE_STATUS, remoteRevision: status.remoteRevision });
    },

    notifyLocalChange() {
      if (householdId === null) return;
      void refreshPending();

      // While backing off, the retry timer owns the schedule; hammering a
      // server that just failed only makes things worse.
      if (attempt > 0) return;

      cancelDebounce?.();
      cancelDebounce = schedule(() => {
        cancelDebounce = null;
        void syncNow();
      }, LOCAL_CHANGE_DEBOUNCE_MS);
    },

    syncNow,

    onForeground() {
      if (householdId === null) return;
      backend.setForeground(true);
      void syncNow();
    },

    notifyDataReplaced() {
      setStatus({ remoteRevision: status.remoteRevision + 1 });
    },

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
