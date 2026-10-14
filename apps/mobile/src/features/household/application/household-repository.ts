import type { SettingsRepository } from '@/shared/settings/settings-repository';

import { isCompleteInviteCode, normalizeInviteCode } from '../domain/invite-code';
import {
  InviteRejectedError,
  SharingError,
  type Household,
  type Invite,
  type Member,
} from '../domain/household';
import type { HouseholdBackend } from '../domain/ports';

export const HOUSEHOLD_SETTING_KEY = 'household';

/**
 * Household membership: what the server says (create, join, leave, members,
 * invites) plus the one fact kept on the device, which household this is.
 *
 * Joining and creating only talk to the server. Remembering the membership is a
 * separate step (`remember`), so the caller can prepare the local data first and
 * a crash in between never leaves the device in a household it is not set up for.
 */
export interface HouseholdRepository {
  /** The household this device remembers, or null in solo mode. */
  getCurrent(): Promise<Household | null>;
  remember(household: Household): Promise<void>;
  forget(): Promise<void>;

  create(name: string, displayName: string | null): Promise<Household>;
  /** Throws `InviteRejectedError` when the server refuses the code. */
  join(code: string, displayName: string | null): Promise<Household>;
  leave(): Promise<void>;
  /** The server's view of this identity's household. Null if it belongs to none. */
  fetchFromServer(): Promise<Household | null>;

  createInvite(householdId: string): Promise<Invite>;
  listInvites(householdId: string): Promise<Invite[]>;
  revokeInvite(inviteId: string): Promise<void>;
  listMembers(householdId: string): Promise<Member[]>;
}

export type HouseholdRepositoryDeps = {
  backend: HouseholdBackend;
  settings: SettingsRepository;
  now?: () => Date;
};

function parseHousehold(raw: string | null): Household | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Household>;
    if (
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      (value.role === 'owner' || value.role === 'member') &&
      typeof value.joinedAt === 'string'
    ) {
      return { id: value.id, name: value.name, role: value.role, joinedAt: value.joinedAt };
    }
  } catch {
    // Fall through: an unreadable record is the same as no membership.
  }
  return null;
}

const MAX_NAME_LENGTH = 60;

function cleanLabel(value: string | null, fallback: string | null): string | null {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function createHouseholdRepository(deps: HouseholdRepositoryDeps): HouseholdRepository {
  const { backend, settings } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async getCurrent() {
      return parseHousehold(await settings.get(HOUSEHOLD_SETTING_KEY));
    },

    async remember(household) {
      await settings.set(HOUSEHOLD_SETTING_KEY, JSON.stringify(household));
    },

    async forget() {
      // The settings port has no delete; an empty value reads back as "none".
      await settings.set(HOUSEHOLD_SETTING_KEY, '');
    },

    async create(name, displayName) {
      const cleanName = cleanLabel(name, null);
      if (cleanName === null) throw new SharingError('rejected', 'A household needs a name.');

      const id = await backend.createHousehold(cleanName, cleanLabel(displayName, null));
      return { id, name: cleanName, role: 'owner', joinedAt: now().toISOString() };
    },

    async join(code, displayName) {
      const normalized = normalizeInviteCode(code);
      // A malformed code cannot exist, so do not spend a throttled attempt on it.
      if (!isCompleteInviteCode(normalized)) throw new InviteRejectedError('invalid');

      const result = await backend.joinHousehold(normalized, cleanLabel(displayName, null));
      if (result.status !== 'ok') throw new InviteRejectedError(result.status);

      const mine = await backend.getMyHousehold();
      return {
        id: result.householdId,
        name: mine?.name ?? '',
        role: mine?.role ?? 'member',
        joinedAt: mine?.joinedAt ?? now().toISOString(),
      };
    },

    async leave() {
      await backend.leaveHousehold();
    },

    async fetchFromServer() {
      return backend.getMyHousehold();
    },

    createInvite: (householdId) => backend.createInvite(householdId),
    listInvites: (householdId) => backend.listInvites(householdId),
    revokeInvite: (inviteId) => backend.revokeInvite(inviteId),
    listMembers: (householdId) => backend.listMembers(householdId),
  };
}
