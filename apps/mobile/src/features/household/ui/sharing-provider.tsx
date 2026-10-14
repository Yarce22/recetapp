import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { SharingRuntime } from '../application/compose-sharing-runtime';
import { IDLE_STATUS } from '../domain/sync-status';

import { useSharing, type UseSharingResult } from './use-sharing';

export type SharingContextValue = UseSharingResult;

/**
 * What a component sees with no provider above it: sharing is off. That keeps
 * the feature hidden (and every screen in solo mode) instead of crashing.
 */
const UNAVAILABLE: SharingContextValue = {
  ready: false,
  snapshot: { available: false, household: null, membershipLost: false, sync: IDLE_STATUS },
  service: null,
};

export const SharingContext = createContext<SharingContextValue>(UNAVAILABLE);

/**
 * Mounts `useSharing()` once so the runtime starts for the whole app, and
 * shares its result with every screen.
 *
 * It never blocks rendering: children are drawn straight away and see the
 * "not ready" snapshot until the runtime has restored the membership.
 */
export function SharingProvider({
  children,
  loader,
}: {
  children: ReactNode;
  /** Overrides how the runtime is obtained; for tests. */
  loader?: () => Promise<SharingRuntime>;
}) {
  const { ready, snapshot, service } = useSharing(loader);
  const value = useMemo<SharingContextValue>(
    () => ({ ready, snapshot, service }),
    [ready, snapshot, service],
  );

  return <SharingContext.Provider value={value}>{children}</SharingContext.Provider>;
}

export function useSharingContext(): SharingContextValue {
  return useContext(SharingContext);
}

/** Increases whenever remote changes were written to the local tables. */
export function useRemoteRevision(): number {
  return useContext(SharingContext).snapshot.sync.remoteRevision;
}
