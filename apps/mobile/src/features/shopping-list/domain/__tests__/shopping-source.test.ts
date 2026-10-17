import {
  DEFAULT_SHOPPING_SOURCE,
  parseShoppingSource,
} from '@/features/shopping-list/domain/shopping-source';

describe('parseShoppingSource', () => {
  it('defaults to the weekly menu', () => {
    expect(DEFAULT_SHOPPING_SOURCE).toBe('menu');
  });

  it.each(['menu', 'low-stock'] as const)('keeps a stored %s', (source) => {
    expect(parseShoppingSource(source)).toBe(source);
  });

  it.each([null, '', 'pantry', 'MENU', undefined])(
    'falls back to the default for an unusable value (%s)',
    (raw) => {
      expect(parseShoppingSource(raw as string | null)).toBe(DEFAULT_SHOPPING_SOURCE);
    },
  );
});
