import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { I18nProvider, useI18n, useTranslation } from '@/shared/i18n/i18n-provider';
import { LANGUAGE_SETTING_KEY } from '@/shared/i18n/language';
import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

function setup(options: { stored?: string; deviceLocale?: string } = {}) {
  const repository = new InMemorySettingsRepository();
  const ready = options.stored
    ? repository.set(LANGUAGE_SETTING_KEY, options.stored)
    : Promise.resolve();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider repository={ready.then(() => repository)} deviceLocale={options.deviceLocale}>
      {children}
    </I18nProvider>
  );

  return { repository, wrapper };
}

describe('I18nProvider', () => {
  it('asks the user to choose when nothing is stored', async () => {
    const { wrapper } = setup({ deviceLocale: 'es-AR' });
    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.hasChosen).toBe(false);
  });

  it('suggests the device language but does not treat it as a choice', async () => {
    const { wrapper } = setup({ deviceLocale: 'es-AR' });
    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.suggestedLanguage).toBe('es');
    expect(result.current.language).toBe('es');
    expect(result.current.hasChosen).toBe(false);
  });

  it('suggests English for a device language the app does not have', async () => {
    const { wrapper } = setup({ deviceLocale: 'fr-FR' });
    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.suggestedLanguage).toBe('en');
  });

  it('uses the stored language over the device language', async () => {
    const { wrapper } = setup({ stored: 'en', deviceLocale: 'es-AR' });
    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.hasChosen).toBe(true);
    expect(result.current.language).toBe('en');
    expect(result.current.t('tabs.pantry')).toBe('Pantry');
  });

  it('ignores a stored value it does not recognise', async () => {
    const { wrapper } = setup({ stored: 'klingon', deviceLocale: 'en-US' });
    const { result } = renderHook(() => useI18n(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.hasChosen).toBe(false);
  });

  it('switches language and remembers the choice', async () => {
    const { wrapper, repository } = setup({ deviceLocale: 'en-US' });
    const { result } = renderHook(() => useI18n(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.setLanguage('es');
    });

    expect(result.current.language).toBe('es');
    expect(result.current.hasChosen).toBe(true);
    expect(result.current.t('tabs.pantry')).toBe('Despensa');
    expect(await repository.get(LANGUAGE_SETTING_KEY)).toBe('es');
  });

  it('keeps the choice for the session even if it cannot be saved', async () => {
    const failing = {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
    };
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider repository={failing} deviceLocale="en-US">
          {children}
        </I18nProvider>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.setLanguage('es');
    });

    expect(result.current.language).toBe('es');
  });
});

describe('useTranslation', () => {
  it('works without a provider, in English, so isolated components render', () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.language).toBe('en');
    expect(result.current.t('tabs.menu')).toBe('Menu');
  });
});
