import type { ReactNode } from 'react';

import type { SharingSnapshot } from '../application/compose-sharing-runtime';
import type { SharingService } from '../application/sharing-service';
import type { Household, Invite, Member } from '../domain/household';
import { IDLE_STATUS, type SyncStatus } from '../domain/sync-status';
import { SharingContext, type SharingContextValue } from '../ui/sharing-provider';

export const HOME: Household = {
  id: 'h1',
  name: 'Home',
  role: 'owner',
  joinedAt: '2026-10-01T10:00:00.000Z',
};

export const ME: Member = {
  userId: 'u1',
  displayName: 'Alex',
  role: 'owner',
  joinedAt: '2026-10-01T10:00:00.000Z',
  isYou: true,
};

export const SAM: Member = {
  userId: 'u2',
  displayName: null,
  role: 'member',
  joinedAt: '2026-10-02T09:30:00.000Z',
  isYou: false,
};

export function invite(code = 'ABCDEFGH', id = `invite-${code}`): Invite {
  return { id, code, expiresAt: new Date(2026, 9, 13, 18, 30).toISOString() };
}

export type FakeService = jest.Mocked<SharingService>;

/**
 * A sharing service whose every method is a mock with a sensible default.
 *
 * The mocks are written without parameter lists for brevity, so the object is
 * asserted to the fully typed mock shape once, here.
 */
export function fakeService(
  overrides: Partial<Record<keyof SharingService, jest.Mock>> = {},
): FakeService {
  const service = {
    isAvailable: jest.fn(() => true),
    getState: jest.fn(() => ({ available: true, household: null, membershipLost: false })),
    subscribe: jest.fn(() => () => undefined),
    initialize: jest.fn(async () => undefined),
    hasLocalData: jest.fn(async () => false),
    createHousehold: jest.fn(async () => HOME),
    joinHousehold: jest.fn(async () => HOME),
    leaveHousehold: jest.fn(async () => undefined),
    handleForbidden: jest.fn(async () => undefined),
    dismissMembershipLost: jest.fn(),
    createInvite: jest.fn(async () => invite()),
    listInvites: jest.fn(async () => []),
    revokeInvite: jest.fn(async () => undefined),
    listMembers: jest.fn(async () => [ME]),
    ...overrides,
  };
  return service as unknown as FakeService;
}

export type SharingValueOverrides = {
  ready?: boolean;
  available?: boolean;
  household?: Household | null;
  membershipLost?: boolean;
  sync?: Partial<SyncStatus>;
  service?: SharingService | null;
};

/** A complete `useSharing()` result for tests; defaults to "available, solo, ready". */
export function sharingValue(overrides: SharingValueOverrides = {}): SharingContextValue {
  const snapshot: SharingSnapshot = {
    available: overrides.available ?? true,
    household: overrides.household ?? null,
    membershipLost: overrides.membershipLost ?? false,
    sync: { ...IDLE_STATUS, ...overrides.sync },
  };
  return {
    ready: overrides.ready ?? true,
    snapshot,
    service: overrides.service === undefined ? fakeService() : overrides.service,
  };
}

export function SharingTestProvider({
  value,
  children,
}: {
  value: SharingContextValue;
  children: ReactNode;
}) {
  return <SharingContext.Provider value={value}>{children}</SharingContext.Provider>;
}
