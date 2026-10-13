import { parseStoredLanguage, suggestLanguage } from '@/shared/i18n/language';

describe('suggestLanguage', () => {
  it.each(['es', 'es-AR', 'es_MX', 'es-ES', 'ES-es'])('suggests Spanish for %s', (locale) => {
    expect(suggestLanguage(locale)).toBe('es');
  });

  it.each(['en', 'en-US', 'en_GB'])('suggests English for %s', (locale) => {
    expect(suggestLanguage(locale)).toBe('en');
  });

  it('falls back to English for languages the app does not have', () => {
    expect(suggestLanguage('fr-FR')).toBe('en');
    expect(suggestLanguage('pt-BR')).toBe('en');
  });

  it('falls back to English when the device does not say', () => {
    expect(suggestLanguage(undefined)).toBe('en');
    expect(suggestLanguage(null)).toBe('en');
    expect(suggestLanguage('')).toBe('en');
  });
});

describe('parseStoredLanguage', () => {
  it('accepts the supported codes', () => {
    expect(parseStoredLanguage('en')).toBe('en');
    expect(parseStoredLanguage('es')).toBe('es');
  });

  it('treats anything else as no choice, so the picker shows again', () => {
    expect(parseStoredLanguage(null)).toBeNull();
    expect(parseStoredLanguage('')).toBeNull();
    expect(parseStoredLanguage('fr')).toBeNull();
    expect(parseStoredLanguage('{"language":"es"}')).toBeNull();
  });
});
