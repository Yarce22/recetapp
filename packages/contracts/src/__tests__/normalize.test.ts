import { normalizeIngredientName } from '../normalize.ts';

describe('normalizeIngredientName', () => {
  it('lowercases and trims', () => {
    expect(normalizeIngredientName('  Tomato  ')).toBe('tomato');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeIngredientName('olive    oil')).toBe('olive oil');
  });

  it('strips diacritics', () => {
    expect(normalizeIngredientName('Limón')).toBe('limon');
    expect(normalizeIngredientName('ají')).toBe('aji');
  });

  it('keeps the enye, which is a letter and not an accented n', () => {
    expect(normalizeIngredientName('Ñoquis')).toBe('ñoquis');
  });
});
