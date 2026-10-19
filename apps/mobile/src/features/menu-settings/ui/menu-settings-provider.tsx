import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { MENU_SETTINGS_SETTING_KEY } from '@/shared/config/api';
import { createSettingsRepository } from '@/shared/settings/create-settings-repository';
import type { SettingsRepository } from '@/shared/settings/settings-repository';

import {
  DEFAULT_MENU_SETTINGS,
  parseMenuSettings,
  type MenuSettings,
} from '../domain/menu-settings';

type MenuSettingsContextValue = {
  settings: MenuSettings;
  /** False until the stored choice has been read. */
  ready: boolean;
  update: (next: MenuSettings) => Promise<void>;
};

const MenuSettingsContext = createContext<MenuSettingsContextValue | null>(null);

export type MenuSettingsProviderProps = {
  children: ReactNode;
  /** Where the settings are stored. Defaults to the app's settings storage. */
  repository?: Promise<SettingsRepository> | SettingsRepository;
};

export function MenuSettingsProvider({ children, repository }: MenuSettingsProviderProps) {
  const [settings, setSettings] = useState<MenuSettings>(DEFAULT_MENU_SETTINGS);
  const [ready, setReady] = useState(false);

  const repositoryPromise = useMemo(
    () => Promise.resolve(repository ?? createSettingsRepository()),
    [repository],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await (await repositoryPromise).get(MENU_SETTINGS_SETTING_KEY);
        if (!stored || cancelled) return;
        try {
          setSettings(parseMenuSettings(JSON.parse(stored)));
        } catch {
          // A row we cannot read is not worth crashing over: the defaults are
          // a valid state and the next change overwrites it.
        }
      } catch {
        // Storage unavailable: keep the defaults.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise]);

  const update = useCallback(
    async (next: MenuSettings) => {
      // Applied immediately: a toggle that waits for a write feels broken.
      setSettings(next);
      const repo = await repositoryPromise;
      await repo.set(MENU_SETTINGS_SETTING_KEY, JSON.stringify(next));
    },
    [repositoryPromise],
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <MenuSettingsContext.Provider value={value}>{children}</MenuSettingsContext.Provider>;
}

export function useMenuSettings(): MenuSettingsContextValue {
  const value = useContext(MenuSettingsContext);
  if (!value) {
    throw new Error('useMenuSettings must be used inside a MenuSettingsProvider.');
  }
  return value;
}
