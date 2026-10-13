import { act, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { Language } from '@recetapp/contracts';

import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

import { I18nProvider } from '../i18n-provider';

/**
 * Renders `ui` as a user whose device language is `language` would see it.
 *
 * With nothing stored, the provider uses the device suggestion straight away,
 * so the first render is already in that language. It still reads the (empty)
 * storage afterwards; awaiting that here keeps it from landing outside `act`.
 */
export async function renderInLanguage(ui: ReactElement, language: Language) {
  const repository = new InMemorySettingsRepository();

  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider repository={repository} deviceLocale={language}>
        {children}
      </I18nProvider>
    ),
  });
  await act(async () => {});

  return result;
}
