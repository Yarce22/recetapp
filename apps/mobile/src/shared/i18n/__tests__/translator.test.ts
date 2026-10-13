import { createTranslator } from '@/shared/i18n/translator';

describe('createTranslator', () => {
  it('translates a key into the chosen language', () => {
    expect(createTranslator('en').t('tabs.pantry')).toBe('Pantry');
    expect(createTranslator('es').t('tabs.pantry')).toBe('Despensa');
  });

  it('fills placeholders from the params', () => {
    expect(createTranslator('en').t('menu.goToDay', { day: 'Monday' })).toBe('Go to Monday');
    expect(createTranslator('es').t('menu.goToDay', { day: 'Lunes' })).toBe('Ir a Lunes');
  });

  it('leaves a placeholder without a param visible instead of printing undefined', () => {
    expect(createTranslator('en').t('menu.goToDay')).toBe('Go to {day}');
  });

  it('picks the singular or plural form from count', () => {
    const en = createTranslator('en');
    const es = createTranslator('es');

    expect(en.t('menu.unfilled', { count: 1 })).toMatch(/^1 meal could not/);
    expect(en.t('menu.unfilled', { count: 3 })).toMatch(/^3 meals could not/);
    expect(es.t('menu.unfilled', { count: 1 })).toMatch(/^1 comida no se pudo/);
    expect(es.t('menu.unfilled', { count: 3 })).toMatch(/^3 comidas no se pudieron/);
  });

  it('treats zero as plural', () => {
    expect(createTranslator('en').t('menu.unfilled', { count: 0 })).toMatch(/^0 meals/);
  });

  it('falls back to English when a key is missing from the active catalog', () => {
    const broken = createTranslator('es', { en: { 'tabs.pantry': 'Pantry' }, es: {} } as never);

    expect(broken.t('tabs.pantry')).toBe('Pantry');
  });

  it('returns the key itself when no catalog has it, so a gap is visible', () => {
    const empty = createTranslator('en', { en: {}, es: {} } as never);

    expect(empty.t('tabs.pantry')).toBe('tabs.pantry');
  });

  describe('dates', () => {
    it('formats an ISO date as day and short month in each language', () => {
      expect(createTranslator('en').formatDate('2026-10-12')).toBe('12 Oct');
      expect(createTranslator('es').formatDate('2026-10-12')).toBe('12 oct');
    });

    it('does not shift the day with the device timezone', () => {
      // 1 January would become 31 December if the ISO date went through UTC.
      expect(createTranslator('en').formatDate('2026-01-01')).toBe('1 Jan');
    });

    it('names weekdays by position in a Monday-first week', () => {
      const en = createTranslator('en');
      const es = createTranslator('es');

      expect(en.weekdayName(0)).toBe('Monday');
      expect(en.weekdayName(6)).toBe('Sunday');
      expect(es.weekdayName(0)).toBe('Lunes');
      expect(es.weekdayName(6)).toBe('Domingo');
      expect(en.weekdayName(2, 'short')).toBe('Wed');
      expect(es.weekdayName(2, 'short')).toBe('Mié');
    });
  });

  describe('numbers', () => {
    it('uses a decimal point in English and a comma in Spanish', () => {
      expect(createTranslator('en').formatNumber(0.5)).toBe('0.5');
      expect(createTranslator('es').formatNumber(0.5)).toBe('0,5');
    });

    it('leaves whole numbers alone', () => {
      expect(createTranslator('es').formatNumber(500)).toBe('500');
    });
  });
});
