import { isLanguage, type Language } from '@recetapp/contracts';

export type { Language };

/** Where the chosen language is stored, in the same key/value table as preferences. */
export const LANGUAGE_SETTING_KEY = 'language';

/** Name of each language in that language, which is how the picker labels it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * Picks the language that best matches the device locale.
 *
 * Only a suggestion: the picker highlights it, but the user still confirms on
 * first launch, because a phone set to French should not silently get English.
 */
export function suggestLanguage(locale: string | null | undefined): Language {
  const primary = locale?.split(/[-_]/)[0]?.toLowerCase();
  return primary !== undefined && isLanguage(primary) ? primary : 'en';
}

/**
 * Reads the stored choice.
 *
 * Anything unrecognised counts as "never chose", which shows the picker again
 * rather than guessing.
 */
export function parseStoredLanguage(raw: string | null): Language | null {
  return isLanguage(raw) ? raw : null;
}
