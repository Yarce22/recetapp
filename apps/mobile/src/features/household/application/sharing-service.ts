import type { Mutex } from '@/shared/sync/mutex';
import { SYNC_ENTITY_NAMES, type SyncEntityName } from '@/shared/sync/sync-entities';
import type { SyncStore } from '@/shared/sync/sync-store';

import {
  LocalDataDecisionRequired,
  SharingError,
  type Household,
  type Invite,
  type LeavePolicy,
  type LocalDataPolicy,
  type Member,
} from '../domain/household';
import type { EntityStore } from '../domain/ports';

import type { HouseholdRepository } from './household-repository';
import { PENDING_UPLOAD_FLAG, type SyncEngine } from './sync-engine';

export type SharingServiceDeps = {
  /** False when the build has no Supabase configuration. */
  available: boolean;
  repository: HouseholdRepository;
  engine: SyncEngine;
  store: SyncStore;
  stores: Record<SyncEntityName, EntityStore>;
  lock: Mutex;
};

export type SharingServiceState = {
  available: boolean;
  household: Household | null;
  /** True when the server no longer recognises this device as a member. */
  membershipLost: boolean;
};

export type JoinOptions = {
  displayName?: string | null;
  /**
   * Required when the device already has data. `upload` shares it with the
   * household (the household's version wins on a collision); `discard` replaces
   * it with the household's.
   */
  localData?: LocalDataPolicy;
};

export type LeaveOptions = {
  /** `keep` (default) leaves a solo copy on the device; `discard` empties it. */
  localData?: LeavePolicy;
};

/**
 * Sharing use cases: create, join and leave a household, invites and members.
 *
 * Owns the one decision that must not be taken silently: what happens to the
 * data already on the device when it joins, and to the shared copy when it
 * leaves.
 */
export interface SharingService {
  isAvailable(): boolean;
  getState(): SharingServiceState;
  subscribe(listener: (state: SharingServiceState) => void): () => void;

  /** Loads the remembered membership and, if there is one, starts syncing. */
  initialize(): Promise<void>;
  /** True when the pantry, the plan or the ticks hold anything. */
  hasLocalData(): Promise<boolean>;

  createHousehold(name: string, displayName?: string | null): Promise<Household>;
  joinHousehold(code: string, options?: JoinOptions): Promise<Household>;
  leaveHousehold(options?: LeaveOptions): Promise<void>;
  /**
   * The server refused a write. Checks whether the device is still a member and,
   * if not, falls back to solo mode with the local copy intact. Wired to the
   * engine's `onForbidden` hook by the composition root.
   */
  handleForbidden(): Promise<void>;
  /** Acknowledges the "membership lost" notice. */
  dismissMembershipLost(): void;

  createInvite(): Promise<Invite>;
  listInvites(): Promise<Invite[]>;
  revokeInvite(inviteId: string): Promise<void>;
  listMembers(): Promise<Member[]>;
}

export function createSharingService(deps: SharingServiceDeps): SharingService {
  const { repository, engine, store, stores, lock } = deps;

  let state: SharingServiceState = {
    available: deps.available,
    household: null,
    membershipLost: false,
  };
  const listeners = new Set<(state: SharingServiceState) => void>();

  function setState(patch: Partial<SharingServiceState>): void {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  }

  function requireAvailable(): void {
    if (!deps.available) {
      throw new SharingError('unavailable', 'Sharing is not set up in this build.');
    }
  }

  function requireHousehold(): Household {
    if (!state.household) throw new SharingError('rejected', 'This device is not in a household.');
    return state.household;
  }

  async function hasLocalData(): Promise<boolean> {
    for (const entity of SYNC_ENTITY_NAMES) {
      if ((await stores[entity].readAll()).length > 0) return true;
    }
    return false;
  }

  async function clearLocalData(): Promise<void> {
    for (const entity of SYNC_ENTITY_NAMES) await stores[entity].clear();
  }

  /**
   * The server says this device is not in a household any more (a reinstall, or
   * a new anonymous identity). Keep the local copy as solo data and say so.
   */
  async function handleForbidden(): Promise<void> {
    const household = state.household;
    if (!household) return;

    let remote: Household | null;
    try {
      remote = await repository.fetchFromServer();
    } catch {
      return; // Cannot tell; the engine keeps retrying and will ask again.
    }
    if (remote && remote.id === household.id) return; // Still a member: a transient refusal.

    await engine.stop();
    await lock.run(() => store.reset());
    await repository.forget();
    setState({ household: null, membershipLost: true });
  }

  async function beginSyncing(household: Household): Promise<void> {
    await repository.remember(household);
    setState({ household, membershipLost: false });
    engine.start(household.id);
  }

  return {
    isAvailable: () => deps.available,
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async initialize() {
      if (!deps.available) return;
      const household = await repository.getCurrent();
      if (!household) return;
      setState({ household });
      engine.start(household.id);
    },

    hasLocalData,

    async createHousehold(name, displayName = null) {
      requireAvailable();
      if (state.household) throw new SharingError('rejected', 'Already in a household.');

      const household = await repository.create(name, displayName);

      // The creator's data becomes the household's: nothing remote can collide.
      await lock.run(async () => {
        await store.reset();
        await store.setState(`${PENDING_UPLOAD_FLAG}:${household.id}`, '1');
      });
      await beginSyncing(household);
      return household;
    },

    async joinHousehold(code, options = {}) {
      requireAvailable();
      if (state.household) throw new SharingError('rejected', 'Already in a household.');

      // Decided before the network is touched: nothing is consumed or changed
      // until the person has said what to do with what they have.
      const hadData = await hasLocalData();
      if (hadData && !options.localData) throw new LocalDataDecisionRequired();

      const household = await repository.join(code, options.displayName ?? null);

      const discard = hadData && options.localData === 'discard';
      await lock.run(async () => {
        await store.reset();
        if (discard) await clearLocalData();
        if (hadData && !discard) {
          await store.setState(`${PENDING_UPLOAD_FLAG}:${household.id}`, '1');
        }
      });
      if (discard) engine.notifyDataReplaced();

      await beginSyncing(household);
      return household;
    },

    async leaveHousehold(options = {}) {
      const household = requireHousehold();
      const policy = options.localData ?? 'keep';

      // Last chance to hand the household what was queued. Never rejects.
      await engine.syncNow();
      await engine.stop();

      try {
        await repository.leave();
      } catch (error) {
        engine.start(household.id); // Still a member: carry on as before.
        throw error;
      }

      await lock.run(async () => {
        // Unpushed edits are not carried into solo mode as pending work; the
        // local copy simply keeps whatever it holds.
        await store.reset();
        if (policy === 'discard') await clearLocalData();
      });
      await repository.forget();
      if (policy === 'discard') engine.notifyDataReplaced();
      setState({ household: null, membershipLost: false });
    },

    dismissMembershipLost() {
      setState({ membershipLost: false });
    },

    createInvite: () => repository.createInvite(requireHousehold().id),
    listInvites: () => repository.listInvites(requireHousehold().id),
    revokeInvite: (inviteId) => repository.revokeInvite(inviteId),
    listMembers: () => repository.listMembers(requireHousehold().id),

    handleForbidden,
  };
}
