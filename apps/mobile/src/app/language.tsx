import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { LanguagePicker } from '@/shared/i18n/language-picker';

/**
 * Language choice: the first screen of a fresh install, and reachable later
 * from the Pantry header.
 */
export default function LanguageScreen() {
  const { language, hasChosen, suggestedLanguage, setLanguage } = useI18n();
  const [picked, setPicked] = useState(false);
  // Fixed at mount: on first launch this screen is the whole stack, and a
  // close button with nowhere to go would be a trap.
  const [canClose] = useState(() => router.canGoBack());

  useEffect(() => {
    // Navigation waits for the choice to be in effect. On first launch the
    // tabs only exist once `hasChosen` is true, so leaving earlier would
    // aim at a screen that is not there yet.
    if (!picked || !hasChosen) return;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [picked, hasChosen]);

  return (
    <LanguagePicker
      suggested={suggestedLanguage}
      selected={hasChosen ? language : null}
      onSelect={async (next) => {
        await setLanguage(next);
        setPicked(true);
      }}
      onClose={canClose ? () => router.back() : undefined}
    />
  );
}
