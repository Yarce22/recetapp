import { useCallback, useEffect, useState } from 'react';

import { createSettingsRepository } from '@/shared/settings/create-settings-repository';

import {
  DEFAULT_SHOPPING_SOURCE,
  parseShoppingSource,
  SHOPPING_SOURCE_SETTING_KEY,
  type ShoppingSource,
} from '../domain/shopping-source';

/**
 * The stored choice of what the shopping list is built from.
 *
 * Kept on this device only: it is a way of using the list, not household data.
 */
export function useShoppingSource() {
  const [source, setSourceState] = useState<ShoppingSource>(DEFAULT_SHOPPING_SOURCE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const repository = await createSettingsRepository();
        const stored = await repository.get(SHOPPING_SOURCE_SETTING_KEY);
        if (!cancelled) setSourceState(parseShoppingSource(stored));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setSource = useCallback(async (next: ShoppingSource) => {
    // Applied immediately: a switch that waits for a write feels broken.
    setSourceState(next);
    const repository = await createSettingsRepository();
    await repository.set(SHOPPING_SOURCE_SETTING_KEY, next);
  }, []);

  return { source, loaded, setSource };
}
