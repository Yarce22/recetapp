import { InvalidIngredientError } from './errors';
import type { Unit } from './units';

export type IngredientId = string;

export type IngredientCategory = 'produce' | 'dairy' | 'meat' | 'grain' | 'spice' | 'other';

export type Ingredient = {
  id: IngredientId;
  /** Normalized form, used for matching against recipes. */
  name: string;
  /** What the user typed, used for display. */
  displayName: string;
  category: IngredientCategory;
  defaultUnit: Unit;
};

/**
 * Placeholder standing in for the eñe while diacritics are stripped.
 *
 * NFD decomposition turns "ñ" into "n" plus a combining tilde, and removing
 * combining marks would then turn it into "n". In Spanish the eñe is a letter
 * of its own, not an accented n: folding it would merge words that are
 * genuinely different.
 */
const ENIE_PLACEHOLDER = '\u0001';

/**
 * Normalizes an ingredient name for matching.
 *
 * Lowercases, collapses whitespace and strips accents, so "Limón" and "limon"
 * are recognised as the same thing.
 *
 * Deliberately does NOT convert plurals to singular. Doing that correctly
 * needs per-language rules, and a naive implementation mangles words like
 * "arroz". Plural handling belongs in a lookup table, and is out of scope
 * until matching quality actually requires it.
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll('ñ', ENIE_PLACEHOLDER)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll(ENIE_PLACEHOLDER, 'ñ')
    .trim()
    .replace(/\s+/g, ' ');
}

export type CreateIngredientInput = {
  id: IngredientId;
  name: string;
  category: IngredientCategory;
  defaultUnit: Unit;
};

export function createIngredient(input: CreateIngredientInput): Ingredient {
  const name = normalizeIngredientName(input.name);
  if (name.length === 0) {
    throw new InvalidIngredientError('An ingredient needs a name.');
  }

  return {
    id: input.id,
    name,
    displayName: input.name.trim().replace(/\s+/g, ' '),
    category: input.category,
    defaultUnit: input.defaultUnit,
  };
}
