export type HouseholdRole = 'owner' | 'member';

/** The household this device belongs to. */
export type Household = {
  id: string;
  name: string;
  role: HouseholdRole;
  /** ISO instant at which this device joined. */
  joinedAt: string;
};

export type Member = {
  userId: string;
  /** Optional label chosen by the person; null when they gave none. */
  displayName: string | null;
  role: HouseholdRole;
  joinedAt: string;
  isYou: boolean;
};

export type Invite = {
  id: string;
  /** Eight characters from the invite alphabet, without the dash. */
  code: string;
  expiresAt: string;
};

export type JoinResult =
  | { status: 'ok'; householdId: string }
  // One answer for unknown, expired, revoked and already used codes, so a
  // guesser learns nothing from the difference.
  | { status: 'invalid' }
  | { status: 'throttled' }
  | { status: 'already_member' }
  | { status: 'full' };

/** What to do with the pantry, menu and ticks already on the device when joining. */
export type LocalDataPolicy = 'upload' | 'discard';

/** What to do with the local copy when leaving. */
export type LeavePolicy = 'keep' | 'discard';

export type SharingErrorKind =
  /** No network, or the request timed out. Retry later. */
  | 'offline'
  /** The session is missing or expired. Refresh it and retry once. */
  | 'auth'
  /** Row Level Security refused the write: the device is not a member. */
  | 'forbidden'
  /** The server refused this specific payload. Retrying will not help. */
  | 'rejected'
  /** The server failed. Retry later. */
  | 'server'
  /** Sharing is not configured in this build. */
  | 'unavailable';

export class SharingError extends Error {
  constructor(
    readonly kind: SharingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SharingError';
  }
}

/** Thrown when the device has local data and the caller did not say what to do with it. */
export class LocalDataDecisionRequired extends Error {
  constructor() {
    super('This device already has data. Choose to upload it or discard it before joining.');
    this.name = 'LocalDataDecisionRequired';
  }
}

export class InviteRejectedError extends Error {
  constructor(readonly reason: Exclude<JoinResult['status'], 'ok'>) {
    super(`Joining was refused: ${reason}.`);
    this.name = 'InviteRejectedError';
  }
}
