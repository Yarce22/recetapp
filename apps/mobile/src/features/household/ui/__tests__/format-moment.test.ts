import { createTranslator } from '@/shared/i18n/translator';

import { formatMoment } from '../format-moment';

// Built from local parts so the expectation does not depend on the test machine's zone.
const instant = new Date(2026, 9, 12, 14, 5).toISOString();

describe('formatMoment', () => {
  it('writes the local day, month and time from the catalog', () => {
    expect(formatMoment(instant, createTranslator('en').formatDate)).toBe('12 Oct, 14:05');
    expect(formatMoment(instant, createTranslator('es').formatDate)).toBe('12 oct, 14:05');
  });

  it('pads minutes and hours', () => {
    const early = new Date(2026, 0, 3, 7, 9).toISOString();

    expect(formatMoment(early, createTranslator('en').formatDate)).toBe('3 Jan, 07:09');
  });

  it('returns an empty string for an unreadable instant', () => {
    expect(formatMoment('not a date', createTranslator('en').formatDate)).toBe('');
  });
});
