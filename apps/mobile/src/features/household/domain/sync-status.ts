import type { SharingErrorKind } from './household';

/**
 * What the user can be told about synchronization.
 *
 * - `synced`: nothing is waiting and the last cycle succeeded
 * - `syncing`: a cycle is running
 * - `offline`: the network is unreachable; changes are queued and will be sent
 * - `error`: the server answered but something is wrong; see `error`
 */
export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export type SyncStatus = {
  state: SyncState;
  /** Local changes queued and not yet acknowledged by the server. */
  pending: number;
  /** ISO instant of the last successful cycle, or null if none yet. */
  lastSyncedAt: string | null;
  /** Why the last cycle failed, when `state` is `error` or `offline`. */
  error: SharingErrorKind | null;
  /** Whether live updates are flowing. When false, updates arrive on the next pull. */
  realtimeConnected: boolean;
  /** Changes the server refused for good and the engine dropped. */
  rejected: number;
  /**
   * Increases whenever a remote change was written into the local tables.
   * Screens watch it to reload their data.
   */
  remoteRevision: number;
};

export const IDLE_STATUS: SyncStatus = {
  state: 'synced',
  pending: 0,
  lastSyncedAt: null,
  error: null,
  realtimeConnected: false,
  rejected: 0,
  remoteRevision: 0,
};
