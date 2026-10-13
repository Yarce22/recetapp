import type { Language } from '@recetapp/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { createSettingsRepository } from '@/shared/settings/create-settings-repository';
import type { SettingsRepository } from '@/shared/settings/settings-repository';

import { getDeviceLocale } from './device-locale';
import { LANGUAGE_SETTING_KEY, parseStoredLanguage, suggestLanguage } from './language';
import { createTranslator, type Translator } from './translator';

export type I18nContextValue = Translator & {
  /** `loading` until the stored choice has been read. */
  status: 'loading' | 'ready';
  /** False on a fresh install, when the picker has to be shown. */
  hasChosen: boolean;
  /** Best match for the device locale. Only ever a suggestion. */
  suggestedLanguage: Language;
  setLanguage: (language: Language) => Promise<void>;
};

/**
 * What components get with no provider above them: English.
 *
 * It lets a component be rendered in isolation without wrapping it, and means
 * a missing provider degrades to the original language rather than crashing.
 */
const FALLBACK: I18nContextValue = {
  ...createTranslator('en'),
  status: 'ready',
  hasChosen: true,
  suggestedLanguage: 'en',
  setLanguage: async () => {},
};

const I18nContext = createContext<I18nContextValue>(FALLBACK);

export type I18nProviderProps = {
  children: ReactNode;
  /** Where the choice is stored. Defaults to the app's settings storage. */
  repository?: SettingsRepository | Promise<SettingsRepository>;
  /** Overrides the device locale; for tests. */
  deviceLocale?: string;
};

/**
 * Holds the active language and persists the user's choice.
 *
 * Until the user picks, the language is the device suggestion so the first
 * screen is readable, but `hasChosen` stays false and the app shows the picker.
 */
export function I18nProvider({ children, repository, deviceLocale }: I18nProviderProps) {
  const [chosen, setChosen] = useState<Language | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  const repositoryPromise = useMemo(
    () => Promise.resolve(repository ?? createSettingsRepository()),
    [repository],
  );
  const suggestedLanguage = useMemo(
    () => suggestLanguage(deviceLocale ?? getDeviceLocale()),
    [deviceLocale],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await (await repositoryPromise).get(LANGUAGE_SETTING_KEY);
        if (!cancelled) setChosen(parseStoredLanguage(stored));
      } catch {
        // Unreadable storage is the same as no choice: ask again.
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise]);

  const setLanguage = useCallback(
    async (language: Language) => {
      // Applied first: the screen should switch language at the tap, not
      // after a write.
      setChosen(language);
      try {
        await (await repositoryPromise).set(LANGUAGE_SETTING_KEY, language);
      } catch {
        // The choice holds for this session. Failing to remember it is worth
        // asking again next launch, not interrupting the user over.
      }
    },
    [repositoryPromise],
  );

  const language = chosen ?? suggestedLanguage;
  const translator = useMemo(() => createTranslator(language), [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      ...translator,
      status,
      hasChosen: chosen !== null,
      suggestedLanguage,
      setLanguage,
    }),
    [translator, status, chosen, suggestedLanguage, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Everything about the language: translation, dates, and the setter. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Just the translation functions, for components that only render text. */
export function useTranslation(): Translator {
  return useContext(I18nContext);
}
