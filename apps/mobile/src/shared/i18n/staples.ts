import { LANGUAGES, normalizeIngredientName, type Language } from '@recetapp/contracts';

import type { TranslationKey } from './catalog';
import { createTranslator, type Translate } from './translator';

/**
 * Staples as they are stored: English names, which is also what the preferences
 * default to. The label shown is translated; the stored value never changes,
 * so preferences saved before the language setting keep working.
 */
const STAPLE_KEYS: Record<string, TranslationKey> = {
  water: 'staple.water',
  salt: 'staple.salt',
  pepper: 'staple.pepper',
  'cooking oil': 'staple.cookingOil',
  sugar: 'staple.sugar',
  flour: 'staple.flour',
};

/** The text to show for a stored staple; unknown ones are shown as stored. */
export function stapleLabel(t: Translate, staple: string): string {
  const key = STAPLE_KEYS[normalizeIngredientName(staple)];
  return key ? t(key) : staple;
}

/**
 * The staples plus their name in `language`.
 *
 * Staples are matched against ingredient names by text. A model asked to answer
 * in Spanish writes "sal", not "salt", so without the Spanish name a pantry
 * staple would be reported as missing and strict mode would reject dishes the
 * user can cook. The stored English name stays in the list, untouched.
 */
export function withLocalizedStaples(staples: string[], language: Language): string[] {
  if (language === 'en') return staples;

  const { t } = createTranslator(language);
  const seen = new Set(staples.map(normalizeIngredientName));
  const extra: string[] = [];

  for (const staple of staples) {
    const key = STAPLE_KEYS[normalizeIngredientName(staple)];
    if (!key) continue;

    const localized = t(key);
    const normalized = normalizeIngredientName(localized);
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    extra.push(localized);
  }

  return [...staples, ...extra];
}

/**
 * The staples plus their names in every language.
 *
 * For matching what the user already has against text written earlier, which
 * may be in either language: a week planned in Spanish and viewed after
 * switching to English still names "sal", and salt is still a staple.
 */
export function withAllLocalizedStaples(staples: string[]): string[] {
  return LANGUAGES.reduce((all, language) => withLocalizedStaples(all, language), staples);
}
