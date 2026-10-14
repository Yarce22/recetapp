import type { SettingsRepository } from '@/shared/settings/settings-repository';
import { Mutex } from '@/shared/sync/mutex';
import type { SyncEntityName } from '@/shared/sync/sync-entities';
import {
  createSyncRecorder,
  setSyncRecorder,
  soloRecorder,
  type SyncRecorder,
} from '@/shared/sync/sync-recorder';
import type { SyncStore } from '@/shared/sync/sync-store';

import type { Household } from '../domain/household';
import type { EntityStore, HouseholdBackend, SyncBackend } from '../domain/ports';
import type { SyncStatus } from '../domain/sync-status';

import { createHouseholdRepository } from './household-repository';
import { createSharingService, type SharingService } from './sharing-service';
import { createSyncEngine, type Scheduler, type SyncEngine } from './sync-engine';

/** Everything a screen needs to render sharing, in one immutable value. */
export type SharingSnapshot = {
  /** False when the build has no Supabase configuration: hide the feature. */
  available: boolean;
  household: Household | null;
  /** True when the server stopped recognising this device as a member. */
  membershipLost: boolean;
  sync: SyncStatus;
};

export interface SharingRuntime {
  service: SharingService;
  engine: SyncEngine;
  /** Referentially stable until something changes: safe for `useSyncExternalStore`. */
  getSnapshot(): SharingSnapshot;
  subscribe(listener: () => void): () => void;
  /** Restores the membership, installs the recorder and starts syncing if needed. */
  start(): Promise<void>;
}

export type ComposeSharingRuntimeDeps = {
  available: boolean;
  householdBackend: HouseholdBackend;
  syncBackend: SyncBackend;
  settings: SettingsRepository;
  store: SyncStore;
  /** Over the repositories WITHOUT the sync decorator: applying a remote row must not re-queue it. */
  stores: Record<SyncEntityName, EntityStore>;
  scheduler?: Scheduler;
  random?: () => number;
  now?: () => Date;
  /** Where the recorder is installed. Defaults to the process-wide registry. */
  installRecorder?: (recorder: SyncRecorder) => void;
};

/** Pure composition of the sharing core. Takes every dependency as an argument. */
export function composeSharingRuntime(deps: ComposeSharingRuntimeDeps): SharingRuntime {
  const lock = new Mutex();
  const install = deps.installRecorder ?? setSyncRecorder;

  // The service needs the engine and the engine's hook needs the service.
  let service: SharingService | null = null;

  const engine = createSyncEngine({
    backend: deps.syncBackend,
    store: deps.store,
    stores: deps.stores,
    lock,
    scheduler: deps.scheduler,
    random: deps.random,
    now: deps.now,
    onForbidden: () => void service?.handleForbidden(),
  });

  service = createSharingService({
    available: deps.available,
    repository: createHouseholdRepository({
      backend: deps.householdBackend,
      settings: deps.settings,
      now: deps.now,
    }),
    engine,
    store: deps.store,
    stores: deps.stores,
    lock,
  });
  const sharing = service;

  const recorder = createSyncRecorder({
    store: deps.store,
    lock,
    isActive: () => sharing.getState().household !== null,
    onQueued: () => engine.notifyLocalChange(),
  });

  let snapshot: SharingSnapshot = {
    ...sharing.getState(),
    sync: engine.getStatus(),
  };
  const listeners = new Set<() => void>();

  function refresh(): void {
    snapshot = { ...sharing.getState(), sync: engine.getStatus() };
    for (const listener of [...listeners]) listener();
  }
  sharing.subscribe(refresh);
  engine.subscribe(refresh);

  return {
    service: sharing,
    engine,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      // Nothing is recorded unless sharing is available: solo stays untouched.
      install(deps.available ? recorder : soloRecorder);
      await sharing.initialize();
    },
  };
}
