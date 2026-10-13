import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage } from '../language.ts';

describe('language', () => {
  it('supports English and Spanish', () => {
    expect([...LANGUAGES]).toEqual(['en', 'es']);
  });

  it('defaults to English so clients that predate the field keep working', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('recognises supported codes only', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage('EN')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
