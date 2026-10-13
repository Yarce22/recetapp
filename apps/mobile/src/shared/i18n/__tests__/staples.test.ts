import { stapleLabel, withAllLocalizedStaples, withLocalizedStaples } from '@/shared/i18n/staples';
import { createTranslator } from '@/shared/i18n/translator';

describe('stapleLabel', () => {
  it('shows a known staple in the active language', () => {
    expect(stapleLabel(createTranslator('en').t, 'cooking oil')).toBe('cooking oil');
    expect(stapleLabel(createTranslator('es').t, 'cooking oil')).toBe('aceite');
    expect(stapleLabel(createTranslator('es').t, 'salt')).toBe('sal');
  });

  it('shows an unknown staple as it was stored', () => {
    expect(stapleLabel(createTranslator('es').t, 'saffron')).toBe('saffron');
  });
});

describe('withLocalizedStaples', () => {
  it('returns the staples untouched in English', () => {
    expect(withLocalizedStaples(['water', 'salt'], 'en')).toEqual(['water', 'salt']);
  });

  it('adds the Spanish name next to the stored English one', () => {
    expect(withLocalizedStaples(['water', 'salt'], 'es')).toEqual(['water', 'salt', 'agua', 'sal']);
  });

  it('keeps staples it does not know and does not duplicate', () => {
    expect(withLocalizedStaples(['saffron', 'Sal'], 'es')).toEqual(['saffron', 'Sal']);
  });

  it('adds nothing for staples the user turned off', () => {
    expect(withLocalizedStaples([], 'es')).toEqual([]);
  });
});

describe('withAllLocalizedStaples', () => {
  it('recognises a staple in either language', () => {
    expect(withAllLocalizedStaples(['salt', 'flour'])).toEqual(['salt', 'flour', 'sal', 'harina']);
  });

  it('adds nothing for staples the user turned off', () => {
    expect(withAllLocalizedStaples([])).toEqual([]);
  });
});
