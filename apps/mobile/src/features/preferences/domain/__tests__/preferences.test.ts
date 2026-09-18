import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  toggleStaple,
} from '@/features/preferences/domain/preferences';

describe('parsePreferences', () => {
  it('returns the defaults when nothing has been stored yet', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('defaults to strict, because proposing food you do not have is the surprising answer', () => {
    expect(DEFAULT_PREFERENCES.suggestionMode).toBe('strict');
  });

  it('ships the basics that make strict mode usable', () => {
    expect(DEFAULT_PREFERENCES.staples).toEqual(['water', 'salt', 'pepper', 'cooking oil']);
  });

  it('keeps what was stored', () => {
    const stored = {
      suggestionMode: 'flexible',
      maxMissingIngredients: 2,
      staples: ['salt'],
      dietary: ['vegetarian'],
      dislikes: ['peanut'],
    };

    expect(parsePreferences(stored)).toEqual(stored);
  });

  it('falls back to the defaults for fields that are missing or the wrong type', () => {
    const parsed = parsePreferences({ suggestionMode: 'nonsense', staples: 'salt' });

    expect(parsed.suggestionMode).toBe(DEFAULT_PREFERENCES.suggestionMode);
    expect(parsed.staples).toEqual(DEFAULT_PREFERENCES.staples);
  });

  it('clamps an out-of-range allowance instead of sending it to the server', () => {
    expect(parsePreferences({ maxMissingIngredients: -4 }).maxMissingIngredients).toBe(0);
    expect(parsePreferences({ maxMissingIngredients: 999 }).maxMissingIngredients).toBe(20);
  });

  it('drops blank entries from the lists', () => {
    expect(parsePreferences({ dislikes: ['peanut', '   ', ''] }).dislikes).toEqual(['peanut']);
  });
});

describe('toggleStaple', () => {
  it('removes a staple that is currently enabled', () => {
    const next = toggleStaple(DEFAULT_PREFERENCES, 'salt');
    expect(next.staples).not.toContain('salt');
  });

  it('adds a staple back', () => {
    const without = toggleStaple(DEFAULT_PREFERENCES, 'salt');
    expect(toggleStaple(without, 'salt').staples).toContain('salt');
  });

  it('matches regardless of spelling, so a staple is not added twice', () => {
    const next = toggleStaple({ ...DEFAULT_PREFERENCES, staples: ['sal'] }, 'SAL');
    expect(next.staples).toEqual([]);
  });

  it('leaves the rest of the preferences untouched', () => {
    const next = toggleStaple({ ...DEFAULT_PREFERENCES, dislikes: ['peanut'] }, 'salt');
    expect(next.dislikes).toEqual(['peanut']);
  });
});
