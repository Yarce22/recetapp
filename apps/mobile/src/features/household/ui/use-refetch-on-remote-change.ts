import { useEffect, useRef } from 'react';

import { useRemoteRevision } from './sharing-provider';

/**
 * Runs `refetch` whenever data from the household landed in the local tables.
 *
 * Not on mount: a screen loads its own data once, and this only covers what
 * changes underneath it afterwards. In solo mode the revision never moves, so
 * this does nothing. A failing refetch is ignored; the next change retries.
 */
export function useRefetchOnRemoteChange(refetch: () => Promise<unknown> | void): void {
  const revision = useRemoteRevision();
  const seen = useRef(revision);
  // Always the latest callback, without re-running the effect when it changes.
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });

  useEffect(() => {
    if (seen.current === revision) return;
    seen.current = revision;

    try {
      void Promise.resolve(latest.current()).catch(() => undefined);
    } catch {
      // A synchronous throw is the screen's own problem, not the sync engine's.
    }
  }, [revision]);
}
