import {
  SYNC_ENTITIES,
  SYNC_ENTITY_NAMES,
  keyOfRow,
  type SyncEntityName,
} from '@/shared/sync/sync-entities';

import {
  SharingError,
  type Household,
  type HouseholdRole,
  type Invite,
  type JoinResult,
  type Member,
  type SharingErrorKind,
} from '../domain/household';
import type { HouseholdBackend, RealtimeListener, RemoteRow, SyncBackend } from '../domain/ports';

/**
 * An in-memory stand-in for the Supabase project, faithful where it matters:
 * the server assigns a strictly increasing `updated_at`, writes are upserts,
 * an identical write is a no-op, and invites are single use.
 *
 * It does not model Row Level Security (that lives in SQL and is reviewed
 * there); it only refuses rows from identities that are not members.
 */
export class FakeServer {
  private clock = Date.UTC(2026, 9, 12, 10, 0, 0);
  private householdSeq = 0;
  private inviteSeq = 0;
  private readonly rows = new Map<string, Map<string, RemoteRow>>();
  private readonly households = new Map<string, { name: string; members: Member[] }>();
  private readonly invites = new Map<string, Invite & { householdId: string; used: boolean }>();
  private readonly listeners = new Set<{
    householdId: string;
    listener: RealtimeListener;
    backend: FakeBackend;
  }>();

  /** Rows with this dish title are refused as invalid, to exercise poison records. */
  rejectTitle: string | null = null;
  /** Counts how many pushRows calls reached the server. */
  pushCalls = 0;

  tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  table(householdId: string, entity: SyncEntityName): Map<string, RemoteRow> {
    const id = `${householdId}/${entity}`;
    let table = this.rows.get(id);
    if (!table) {
      table = new Map();
      this.rows.set(id, table);
    }
    return table;
  }

  /** The live (not deleted) rows of a table, for assertions. */
  live(householdId: string, entity: SyncEntityName): RemoteRow[] {
    return [...this.table(householdId, entity).values()].filter((row) => row.deleted !== true);
  }

  row(householdId: string, entity: SyncEntityName, key: string): RemoteRow | undefined {
    return this.table(householdId, entity).get(key);
  }

  isMember(householdId: string, userId: string): boolean {
    return this.households.get(householdId)?.members.some((m) => m.userId === userId) ?? false;
  }

  householdOf(userId: string): (Household & { memberCount: number }) | null {
    for (const [id, household] of this.households) {
      const me = household.members.find((m) => m.userId === userId);
      if (me) {
        return {
          id,
          name: household.name,
          role: me.role,
          joinedAt: me.joinedAt,
          memberCount: household.members.length,
        };
      }
    }
    return null;
  }

  push(
    backend: FakeBackend,
    entity: SyncEntityName,
    householdId: string,
    rows: RemoteRow[],
  ): RemoteRow[] {
    this.pushCalls += 1;
    if (!this.isMember(householdId, backend.userId)) {
      throw new SharingError('forbidden', 'not a member');
    }

    // Validate the whole batch first: a refused row fails the request, like Postgres.
    for (const row of rows) {
      if (this.rejectTitle !== null && row.dish_title === this.rejectTitle) {
        throw new SharingError('rejected', 'check constraint violated');
      }
    }

    const stored: RemoteRow[] = [];
    for (const incoming of rows) {
      const key = keyOfRow(entity, incoming);
      const table = this.table(householdId, entity);
      const existing = table.get(key);

      const payload = { ...incoming, household_id: householdId };
      if (existing && sameContent(existing, payload)) {
        stored.push(existing); // Idempotent: nothing changed, nothing is re-stamped.
        continue;
      }

      const next: RemoteRow = {
        ...payload,
        updated_at: this.tick(),
        updated_by: backend.userId,
      };
      table.set(key, next);
      stored.push(next);
      this.broadcast(householdId, entity, next);
    }
    return stored;
  }

  fetch(
    backend: FakeBackend,
    entity: SyncEntityName,
    householdId: string,
    since: string | null,
    limit: number,
  ): RemoteRow[] {
    if (!this.isMember(householdId, backend.userId)) {
      throw new SharingError('forbidden', 'not a member');
    }
    return [...this.table(householdId, entity).values()]
      .filter((row) => since === null || String(row.updated_at) > since)
      .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
      .slice(0, limit);
  }

  private broadcast(householdId: string, entity: SyncEntityName, row: RemoteRow): void {
    for (const entry of this.listeners) {
      if (entry.householdId === householdId && entry.backend.realtimeOn) {
        entry.listener.onRow(entity, row);
      }
    }
  }

  addListener(householdId: string, listener: RealtimeListener, backend: FakeBackend): () => void {
    const entry = { householdId, listener, backend };
    this.listeners.add(entry);
    listener.onConnection(true);
    return () => this.listeners.delete(entry);
  }

  // --- households ---

  createHousehold(userId: string, name: string, displayName: string | null): string {
    if (this.householdOf(userId)) throw new SharingError('rejected', 'already_in_household');
    this.householdSeq += 1;
    const id = `house-${this.householdSeq}`;
    this.households.set(id, {
      name,
      members: [member(userId, 'owner', displayName)],
    });
    return id;
  }

  createInvite(userId: string, householdId: string): Invite {
    if (!this.isMember(householdId, userId)) throw new SharingError('forbidden', 'not a member');
    this.inviteSeq += 1;
    const code = `AAAA${String(1000 + this.inviteSeq)}`.replace(/[01]/g, '2');
    const invite = {
      id: `invite-${this.inviteSeq}`,
      code,
      expiresAt: new Date(this.clock + 86_400_000).toISOString(),
      householdId,
      used: false,
    };
    this.invites.set(code, invite);
    return { id: invite.id, code, expiresAt: invite.expiresAt };
  }

  revokeInvite(userId: string, inviteId: string): void {
    for (const [code, invite] of this.invites) {
      if (invite.id === inviteId && this.isMember(invite.householdId, userId)) {
        this.invites.delete(code);
      }
    }
  }

  expireInvites(): void {
    for (const invite of this.invites.values()) invite.expiresAt = '2020-01-01T00:00:00.000Z';
  }

  listInvites(userId: string, householdId: string): Invite[] {
    if (!this.isMember(householdId, userId)) throw new SharingError('forbidden', 'not a member');
    return [...this.invites.values()]
      .filter((invite) => invite.householdId === householdId && !invite.used)
      .map(({ id, code, expiresAt }) => ({ id, code, expiresAt }));
  }

  join(userId: string, code: string, displayName: string | null): JoinResult {
    if (this.householdOf(userId)) return { status: 'already_member' };
    const invite = this.invites.get(code);
    if (!invite || invite.used || Date.parse(invite.expiresAt) < this.clock) {
      return { status: 'invalid' };
    }
    invite.used = true;
    this.households.get(invite.householdId)?.members.push(member(userId, 'member', displayName));
    return { status: 'ok', householdId: invite.householdId };
  }

  leave(userId: string): void {
    for (const [id, household] of this.households) {
      const index = household.members.findIndex((m) => m.userId === userId);
      if (index === -1) continue;
      household.members.splice(index, 1);
      if (household.members.length === 0) this.households.delete(id);
    }
  }

  members(userId: string, householdId: string): Member[] {
    if (!this.isMember(householdId, userId)) throw new SharingError('forbidden', 'not a member');
    return (this.households.get(householdId)?.members ?? []).map((m) => ({
      ...m,
      isYou: m.userId === userId,
    }));
  }
}

function member(userId: string, role: HouseholdRole, displayName: string | null): Member {
  return { userId, displayName, role, joinedAt: '2026-10-12T10:00:00.000Z', isYou: false };
}

function sameContent(a: RemoteRow, b: RemoteRow): boolean {
  const names = new Set<string>(['household_id', 'deleted']);
  for (const entity of SYNC_ENTITY_NAMES) {
    for (const column of [
      ...SYNC_ENTITIES[entity].keyColumns,
      ...SYNC_ENTITIES[entity].valueColumns,
    ]) {
      names.add(column);
    }
  }
  return [...names].every(
    (name) => JSON.stringify(a[name] ?? null) === JSON.stringify(b[name] ?? null),
  );
}

/** One phone's connection to the fake server. */
export class FakeBackend implements HouseholdBackend, SyncBackend {
  online = true;
  realtimeOn = true;
  /** When set, the next request fails with this error once. */
  failNext: SharingErrorKind | null = null;
  refreshCalls = 0;

  constructor(
    private readonly server: FakeServer,
    public userId: string,
  ) {}

  private gate(): void {
    if (!this.online) throw new SharingError('offline', 'no network');
    if (this.failNext) {
      const kind = this.failNext;
      this.failNext = null;
      throw new SharingError(kind, `injected ${kind}`);
    }
  }

  async createHousehold(name: string, displayName: string | null) {
    this.gate();
    return this.server.createHousehold(this.userId, name, displayName);
  }
  async createInvite(householdId: string) {
    this.gate();
    return this.server.createInvite(this.userId, householdId);
  }
  async listInvites(householdId: string) {
    this.gate();
    return this.server.listInvites(this.userId, householdId);
  }
  async revokeInvite(inviteId: string) {
    this.gate();
    this.server.revokeInvite(this.userId, inviteId);
  }
  async joinHousehold(code: string, displayName: string | null) {
    this.gate();
    return this.server.join(this.userId, code, displayName);
  }
  async leaveHousehold() {
    this.gate();
    this.server.leave(this.userId);
  }
  async getMyHousehold(): Promise<Household | null> {
    this.gate();
    const mine = this.server.householdOf(this.userId);
    return mine ? { id: mine.id, name: mine.name, role: mine.role, joinedAt: mine.joinedAt } : null;
  }
  async listMembers(householdId: string) {
    this.gate();
    return this.server.members(this.userId, householdId);
  }

  async pushRows(entity: SyncEntityName, householdId: string, rows: RemoteRow[]) {
    this.gate();
    return this.server.push(this, entity, householdId, rows);
  }
  async fetchRows(
    entity: SyncEntityName,
    householdId: string,
    since: string | null,
    limit: number,
  ) {
    this.gate();
    return this.server.fetch(this, entity, householdId, since, limit);
  }
  subscribe(householdId: string, listener: RealtimeListener) {
    return this.server.addListener(householdId, listener, this);
  }
  async refreshSession() {
    this.gate();
    this.refreshCalls += 1;
  }
  setForeground() {
    // Nothing to pause in a fake.
  }
}
