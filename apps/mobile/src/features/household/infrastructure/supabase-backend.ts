import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SharingConfig } from '@/shared/config/sharing';
import type { SettingsRepository } from '@/shared/settings/settings-repository';
import { SYNC_ENTITIES, SYNC_ENTITY_NAMES, type SyncEntityName } from '@/shared/sync/sync-entities';

import {
  SharingError,
  type Household,
  type HouseholdRole,
  type Invite,
  type JoinResult,
  type Member,
} from '../domain/household';
import type { HouseholdBackend, RealtimeListener, RemoteRow, SyncBackend } from '../domain/ports';

import { SupabaseAuthStorage } from './supabase-auth-storage';
import { toSharingError } from './supabase-errors';

type HouseholdRow = { household_id: string; name: string; role: HouseholdRole; joined_at: string };
type InviteRow = { id: string; code: string; expires_at: string };
type MemberRow = {
  user_id: string;
  display_name: string | null;
  role: HouseholdRole;
  joined_at: string;
};

/**
 * Thin Supabase adapter for both ports.
 *
 * It holds no rules: it translates calls into RPCs and table requests, and
 * errors into `SharingError`. Everything that can be decided without the network
 * is decided elsewhere, where a fake can stand in for this class.
 */
export class SupabaseBackend implements HouseholdBackend, SyncBackend {
  private readonly client: SupabaseClient;

  constructor(config: SharingConfig, settings: SettingsRepository) {
    this.client = createClient(config.url, config.key, {
      auth: {
        storage: new SupabaseAuthStorage(settings),
        persistSession: true,
        autoRefreshToken: true,
        // There is no URL to read a session from in a native app.
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }

  // --- identity -----------------------------------------------------------

  /**
   * The current user id, signing in anonymously only when there is genuinely no
   * session. A failed read (for example a refresh while offline) is an error,
   * never a reason to mint a new identity: that would orphan the membership.
   */
  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw toSharingError(error);
    if (data.session) return data.session.user.id;

    const signedIn = await this.client.auth.signInAnonymously();
    if (signedIn.error || !signedIn.data.user) throw toSharingError(signedIn.error);
    return signedIn.data.user.id;
  }

  async refreshSession(): Promise<void> {
    const { data, error } = await this.client.auth.refreshSession();
    if (error && error.name === 'AuthRetryableFetchError') throw toSharingError(error);
    if (error || !data.session) {
      // The refresh token is gone. Starting over is the only way forward; the
      // server will tell us whether the new identity belongs to a household.
      const signedIn = await this.client.auth.signInAnonymously();
      if (signedIn.error) throw toSharingError(signedIn.error);
    }
  }

  setForeground(active: boolean): void {
    if (active) void this.client.auth.startAutoRefresh();
    else void this.client.auth.stopAutoRefresh();
  }

  // --- households ---------------------------------------------------------

  async createHousehold(name: string, displayName: string | null): Promise<string> {
    await this.userId();
    const { data, error } = await this.client.rpc('create_household', {
      p_name: name,
      p_display_name: displayName,
    });
    if (error) throw toSharingError(error);
    return data as string;
  }

  async createInvite(householdId: string): Promise<Invite> {
    await this.userId();
    const { data, error } = await this.client.rpc('create_invite', { p_household_id: householdId });
    if (error) throw toSharingError(error);
    const row = (data as InviteRow[])[0];
    if (!row) throw new SharingError('server', 'The server returned no invite.');
    return { id: row.id, code: row.code, expiresAt: row.expires_at };
  }

  async listInvites(householdId: string): Promise<Invite[]> {
    await this.userId();
    const { data, error } = await this.client
      .from('household_invites')
      .select('id, code, expires_at')
      .eq('household_id', householdId)
      .is('revoked_at', null)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false });
    if (error) throw toSharingError(error);
    return (data as InviteRow[]).map((row) => ({
      id: row.id,
      code: row.code,
      expiresAt: row.expires_at,
    }));
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.userId();
    const { error } = await this.client.rpc('revoke_invite', { p_invite_id: inviteId });
    if (error) throw toSharingError(error);
  }

  async joinHousehold(code: string, displayName: string | null): Promise<JoinResult> {
    await this.userId();
    const { data, error } = await this.client.rpc('join_household', {
      p_code: code,
      p_display_name: displayName,
    });
    if (error) throw toSharingError(error);

    const row = (data as { status: string; household_id: string | null }[])[0];
    switch (row?.status) {
      case 'ok':
        if (row.household_id) return { status: 'ok', householdId: row.household_id };
        throw new SharingError('server', 'The server accepted the code but returned no household.');
      case 'throttled':
      case 'already_member':
      case 'full':
        return { status: row.status };
      default:
        return { status: 'invalid' };
    }
  }

  async leaveHousehold(): Promise<void> {
    await this.userId();
    const { error } = await this.client.rpc('leave_household');
    if (error) throw toSharingError(error);
  }

  async getMyHousehold(): Promise<Household | null> {
    await this.userId();
    const { data, error } = await this.client.rpc('get_my_household');
    if (error) throw toSharingError(error);

    const row = (data as HouseholdRow[])[0];
    return row
      ? { id: row.household_id, name: row.name, role: row.role, joinedAt: row.joined_at }
      : null;
  }

  async listMembers(householdId: string): Promise<Member[]> {
    const me = await this.userId();
    const { data, error } = await this.client
      .from('household_members')
      .select('user_id, display_name, role, joined_at')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true });
    if (error) throw toSharingError(error);

    return (data as MemberRow[]).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      joinedAt: row.joined_at,
      isYou: row.user_id === me,
    }));
  }

  // --- records ------------------------------------------------------------

  async pushRows(
    entity: SyncEntityName,
    householdId: string,
    rows: RemoteRow[],
  ): Promise<RemoteRow[]> {
    await this.userId();
    const onConflict = ['household_id', ...SYNC_ENTITIES[entity].keyColumns].join(',');
    const { data, error } = await this.client
      .from(entity)
      .upsert(
        rows.map((row) => ({ ...row, household_id: householdId })),
        { onConflict },
      )
      .select();
    if (error) throw toSharingError(error);
    return (data ?? []) as RemoteRow[];
  }

  async fetchRows(
    entity: SyncEntityName,
    householdId: string,
    since: string | null,
    limit: number,
  ): Promise<RemoteRow[]> {
    await this.userId();
    let query = this.client.from(entity).select('*').eq('household_id', householdId);
    if (since !== null) query = query.gt('updated_at', since);

    const { data, error } = await query.order('updated_at', { ascending: true }).limit(limit);
    if (error) throw toSharingError(error);
    return (data ?? []) as RemoteRow[];
  }

  subscribe(householdId: string, listener: RealtimeListener): () => void {
    const channel = this.client.channel(`household:${householdId}`);

    for (const entity of SYNC_ENTITY_NAMES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: entity, filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as RemoteRow | undefined;
          if (row && Object.keys(row).length > 0) listener.onRow(entity, row);
        },
      );
    }

    let closed = false;
    // Realtime evaluates Row Level Security with the session's token, so the
    // channel can only be opened once there is one.
    this.userId()
      .then(() => {
        if (closed) return;
        channel.subscribe((status) => listener.onConnection(status === 'SUBSCRIBED'));
      })
      .catch(() => listener.onConnection(false));

    return () => {
      closed = true;
      void this.client.removeChannel(channel);
    };
  }
}
