import type { SyncEntityName } from '@/shared/sync/sync-entities';

import type { Household, Invite, JoinResult, Member } from './household';

/** A row exactly as the backend stores it: snake_case columns, `deleted`, `updated_at`. */
export type RemoteRow = Record<string, unknown>;

/** Household management. Needs the network; a thin adapter over the RPCs. */
export interface HouseholdBackend {
  createHousehold(name: string, displayName: string | null): Promise<string>;
  createInvite(householdId: string): Promise<Invite>;
  listInvites(householdId: string): Promise<Invite[]>;
  revokeInvite(inviteId: string): Promise<void>;
  joinHousehold(code: string, displayName: string | null): Promise<JoinResult>;
  leaveHousehold(): Promise<void>;
  /** The household the signed-in identity belongs to, or null. */
  getMyHousehold(): Promise<Household | null>;
  listMembers(householdId: string): Promise<Member[]>;
}

export type RealtimeListener = {
  onRow(entity: SyncEntityName, row: RemoteRow): void;
  /** `false` when the channel dropped; `true` when it (re)connected. */
  onConnection(connected: boolean): void;
};

/** Record transport for the sync engine. */
export interface SyncBackend {
  /** Upserts rows and returns them as stored, with the server-assigned `updated_at`. */
  pushRows(entity: SyncEntityName, householdId: string, rows: RemoteRow[]): Promise<RemoteRow[]>;
  /** Rows with `updated_at` after `since`, oldest first, at most `limit`. */
  fetchRows(
    entity: SyncEntityName,
    householdId: string,
    since: string | null,
    limit: number,
  ): Promise<RemoteRow[]>;
  subscribe(householdId: string, listener: RealtimeListener): () => void;
  /** Gets a usable session, signing in anonymously if there is none. */
  refreshSession(): Promise<void>;
  /** Lets the adapter pause token refresh while the app is in the background. */
  setForeground(active: boolean): void;
}

/** One entity's local storage, seen by the engine. Never records to the outbox. */
export interface EntityStore {
  /** Every live local record, shaped like a remote row (key and value columns). */
  readAll(): Promise<RemoteRow[]>;
  /** Writes a remote row into the local tables. Throws if the row is not valid. */
  upsert(row: RemoteRow): Promise<void>;
  /** Removes the record with this key. A missing record is not an error. */
  remove(key: string): Promise<void>;
  /** Removes every local record. */
  clear(): Promise<void>;
}
