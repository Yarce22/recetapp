import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { PreferencesDto } from '@recetapp/contracts';

import { DEVICE_ID_SETTING_KEY, PREFERENCES_SETTING_KEY } from '@/shared/config/api';
import { createSettingsRepository } from '@/shared/settings/create-settings-repository';

import { DEFAULT_PREFERENCES, parsePreferences, toggleStaple } from '../domain/preferences';

type PreferencesContextValue = {
  preferences: PreferencesDto;
  /** Anonymous, stable per install. The backend counts requests against it. */
  deviceId: string | null;
  ready: boolean;
  update: (next: PreferencesDto) => Promise<void>;
  toggleStapleByName: (staple: string) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Generates the per-install identifier.
 *
 * Anonymous by design: it identifies a copy of the app, not a person, and it
 * is only ever used so the backend can spread its budget across clients.
 */
function newDeviceId(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PreferencesDto>(DEFAULT_PREFERENCES);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const repositoryPromise = useMemo(() => createSettingsRepository(), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const repository = await repositoryPromise;

        const storedPreferences = await repository.get(PREFERENCES_SETTING_KEY);
        let parsed = DEFAULT_PREFERENCES;
        if (storedPreferences) {
          try {
            parsed = parsePreferences(JSON.parse(storedPreferences));
          } catch {
            // A row we cannot read is not worth crashing over. The defaults
            // are a valid state, and the next save overwrites it.
            parsed = DEFAULT_PREFERENCES;
          }
        }

        let id = await repository.get(DEVICE_ID_SETTING_KEY);
        if (!id) {
          id = newDeviceId();
          await repository.set(DEVICE_ID_SETTING_KEY, id);
        }

        if (!cancelled) {
          setPreferences(parsed);
          setDeviceId(id);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise]);

  const update = useCallback(
    async (next: PreferencesDto) => {
      // Applied immediately: a toggle that waits for a write feels broken.
      setPreferences(next);
      const repository = await repositoryPromise;
      await repository.set(PREFERENCES_SETTING_KEY, JSON.stringify(next));
    },
    [repositoryPromise],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      deviceId,
      ready,
      update,
      toggleStapleByName: (staple: string) => update(toggleStaple(preferences, staple)),
    }),
    [preferences, deviceId, ready, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used inside a PreferencesProvider.');
  }
  return value;
}
