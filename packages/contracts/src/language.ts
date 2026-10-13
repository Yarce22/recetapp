/**
 * Languages the app and the BFF can speak.
 *
 * Shared because the language travels with every request that produces human
 * text: the BFF has to ask the model for the same language the app is showing.
 */
export const LANGUAGES = ['en', 'es'] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * What a request without a language gets.
 *
 * Installed builds that predate the language setting never send the field and
 * were written for English, so English keeps them working unchanged.
 */
export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
