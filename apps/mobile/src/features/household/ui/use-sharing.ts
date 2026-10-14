import { useEffect, useState, useSyncExternalStore } from 'react';

import { isSharingAvailable } from '@/shared/config/sharing';

import type { SharingRuntime, SharingSnapshot } from '../application/compose-sharing-runtime';
import type { SharingService } from '../application/sharing-service';
import { IDLE_STATUS } from '../domain/sync-status';
import { getSharingRuntime } from '../infrastructure/create-sharing-runtime';

const noopSubscribe = () => () => undefined;

/** What the hook reports before the runtime has finished starting. */
const LOADING_SNAPSHOT: SharingSnapshot = {
  available: isSharingAvailable(),
  household: null,
  membershipLost: false,
  sync: IDLE_STATUS,
};

export type UseSharingResult = {
  /** False until the remembered household has been restored. */
  ready: boolean;
  snapshot: SharingSnapshot;
  /** The use cases (create, join, leave, invites, members). Null until ready. */
  service: SharingService | null;
};

/**
 * The single hook the sharing UI needs.
 *
 * Mounting it also starts the runtime, so call it once near the root so the
 * household is restored and local writes begin to sync, even on screens that
 * never show anything about sharing.
 */
export function useSharing(
  loader: () => Promise<SharingRuntime> = getSharingRuntime,
): UseSharingResult {
  const [runtime, setRuntime] = useState<SharingRuntime | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loader().then((loaded) => {
      if (!cancelled) setRuntime(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  const snapshot = useSyncExternalStore(
    runtime ? runtime.subscribe : noopSubscribe,
    runtime ? runtime.getSnapshot : () => LOADING_SNAPSHOT,
  );

  return { ready: runtime !== null, snapshot, service: runtime?.service ?? null };
}
