import type { Language } from '@recetapp/contracts';

import { catalogs as defaultCatalogs, type Catalog, type TranslationKey } from './catalog';

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

export type Translator = {
  language: Language;
  t: Translate;
  /** "2026-10-12" as day and short month ("12 Oct", "12 oct"). */
  formatDate: (isoDate: string) => string;
  /** Weekday by position in a Monday-first week (0 is Monday). */
  weekdayName: (index: number, style?: 'long' | 'short') => string;
  /** A number with the language's decimal separator. */
  formatNumber: (value: number) => string;
};

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * English and Spanish only have one plural distinction: exactly one, or not.
 * A language with richer rules would need its own rule here.
 */
function pluralSuffix(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other';
}

function interpolate(template: string, params: TranslateParams | undefined): string {
  if (!params) return template;
  // A placeholder with no value stays visible: a gap should be noticed, not
  // printed as "undefined".
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Builds the translation functions for one language.
 *
 * Plain functions over plain data, with no React in sight, so it is usable from
 * domain code (the low-stock reminder) and testable without rendering.
 * Dates are formatted from the ISO parts and the catalog rather than through
 * `Intl`: the app deliberately treats dates as calendar days, and `Intl` would
 * reintroduce the timezone that choice avoids.
 */
export function createTranslator(
  language: Language,
  catalogs: Record<Language, Catalog> = defaultCatalogs,
): Translator {
  const lookup = (key: string): string | undefined =>
    (catalogs[language] as Record<string, string>)[key] ??
    (catalogs.en as Record<string, string>)[key];

  const t: Translate = (key, params) => {
    const count = params?.count;
    const plural = typeof count === 'number' ? lookup(`${key}_${pluralSuffix(count)}`) : undefined;
    return interpolate(plural ?? lookup(key) ?? key, params);
  };

  const weekdayName = (index: number, style: 'long' | 'short' = 'long') => {
    const day = WEEKDAYS[index];
    return t((style === 'short' ? `weekday.short.${day}` : `weekday.${day}`) as TranslationKey);
  };

  return {
    language,
    t,
    weekdayName,
    formatDate: (isoDate) =>
      t('date.dayMonth', {
        day: Number(isoDate.slice(8, 10)),
        month: t(`month.short.${Number(isoDate.slice(5, 7))}` as TranslationKey),
      }),
    formatNumber: (value) => (language === 'es' ? String(value).replace('.', ',') : String(value)),
  };
}
