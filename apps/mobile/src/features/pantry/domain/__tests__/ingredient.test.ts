import { createIngredient, normalizeIngredientName } from '@/features/pantry/domain/ingredient';
import { InvalidIngredientError } from '@/features/pantry/domain/errors';

describe('normalizeIngredientName', () => {
  it('lowercases and trims', () => {
    expect(normalizeIngredientName('  Tomato  ')).toBe('tomato');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeIngredientName('olive    oil')).toBe('olive oil');
  });

  it('strips diacritics, so "Limón" and "limon" are the same ingredient', () => {
    expect(normalizeIngredientName('Limón')).toBe('limon');
    expect(normalizeIngredientName('ají')).toBe('aji');
  });

  it('leaves the eñe distinguishable rather than folding it into n', () => {
    // "ñ" is a distinct letter, not an accented n. Folding it would merge
    // words that are genuinely different.
    expect(normalizeIngredientName('Ñoquis')).toBe('ñoquis');
  });
});

describe('createIngredient', () => {
  it('stores the normalized name', () => {
    const ingredient = createIngredient({
      id: 'ing-1',
      name: '  Olive   Oil ',
      category: 'other',
      defaultUnit: 'ml',
    });

    expect(ingredient.name).toBe('olive oil');
  });

  it('keeps the name the user typed for display', () => {
    const ingredient = createIngredient({
      id: 'ing-1',
      name: 'Olive Oil',
      category: 'other',
      defaultUnit: 'ml',
    });

    expect(ingredient.displayName).toBe('Olive Oil');
  });

  it('rejects a blank name', () => {
    expect(() =>
      createIngredient({ id: 'ing-1', name: '   ', category: 'other', defaultUnit: 'g' }),
    ).toThrow(InvalidIngredientError);
  });
});
