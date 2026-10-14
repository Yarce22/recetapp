import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRefetchOnRemoteChange } from '@/features/household/ui/use-refetch-on-remote-change';

import { shoppingCheckKey } from '../domain/shopping-checks-repository';
import { createShoppingChecksRepository } from '../infrastructure/create-shopping-checks-repository';

/**
 * The ticks on the shopping list, stored through the shared checks repository
 * so a household sees the same ones on every phone.
 *
 * Reads and writes go to the local database; syncing happens around it. The
 * ticks are reloaded when household changes land.
 */
export function useShoppingChecks() {
  const repositoryPromise = useMemo(() => createShoppingChecksRepository(), []);
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const repository = await repositoryPromise;
    const checks = await repository.findAll();
    setKeys(new Set(checks.map((check) => check.key)));
  }, [repositoryPromise]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const repository = await repositoryPromise;
        const checks = await repository.findAll();
        if (!cancelled) setKeys(new Set(checks.map((check) => check.key)));
      } catch {
        // Unreadable ticks mean an unticked list, which is a safe thing to show.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise]);

  useRefetchOnRemoteChange(reload);

  const isChecked = useCallback((name: string) => keys.has(shoppingCheckKey(name)), [keys]);

  const toggle = useCallback(
    async (name: string) => {
      const key = shoppingCheckKey(name);
      const ticking = !keys.has(key);

      // Instant feedback; the write follows and the stored state wins if it fails.
      setKeys((current) => {
        const next = new Set(current);
        if (ticking) next.add(key);
        else next.delete(key);
        return next;
      });

      try {
        const repository = await repositoryPromise;
        if (ticking) await repository.check({ key, name });
        else await repository.uncheck(key);
      } catch {
        await reload().catch(() => undefined);
      }
    },
    [keys, repositoryPromise, reload],
  );

  return { loaded, isChecked, toggle };
}
