import { SharingError } from '../domain/household';
import type { HouseholdBackend, SyncBackend } from '../domain/ports';

function unavailable(): never {
  throw new SharingError('unavailable', 'Sharing is not set up in this build.');
}

/** Stands in for Supabase when the build has no configuration. Every call refuses. */
export class UnavailableBackend implements HouseholdBackend, SyncBackend {
  createHousehold = unavailable;
  createInvite = unavailable;
  listInvites = unavailable;
  revokeInvite = unavailable;
  joinHousehold = unavailable;
  leaveHousehold = unavailable;
  getMyHousehold = unavailable;
  listMembers = unavailable;
  pushRows = unavailable;
  fetchRows = unavailable;
  subscribe = unavailable;
  refreshSession = unavailable;

  setForeground(): void {
    // Nothing to pause.
  }
}
