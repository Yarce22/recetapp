import type { Translator } from '@/shared/i18n/translator';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * An instant as the local day and time: "12 Oct, 14:05".
 *
 * The day comes from the catalog-based `formatDate`; the clock time is
 * language-neutral. Returns an empty string for an unreadable instant.
 */
export function formatMoment(iso: string, formatDate: Translator['formatDate']): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatDate(day)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
