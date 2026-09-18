/**
 * Placeholder standing in for the enye while diacritics are stripped.
 *
 * NFD decomposition turns "ñ" into "n" plus a combining tilde, and removing
 * combining marks would then turn it into "n". In Spanish the enye is a letter
 * of its own, not an accented n: folding it would merge words that are
 * genuinely different.
 */
const ENIE_PLACEHOLDER = '';

/**
 * Normalizes an ingredient name for matching.
 *
 * Lowercases, collapses whitespace and strips accents, so "Limón" and "limon"
 * are recognised as the same thing.
 *
 * This lives in the shared package rather than in either side's domain because
 * the app sends pantry names and the BFF compares recipe ingredients against
 * them. If the two normalized differently, matching would silently disagree
 * and strict mode would reject dishes the user can actually cook.
 *
 * Deliberately does NOT convert plurals to singular. Doing that correctly
 * needs per-language rules, and a naive implementation mangles words like
 * "arroz".
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll('ñ', ENIE_PLACEHOLDER)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll(ENIE_PLACEHOLDER, 'ñ')
    .trim()
    .replace(/\s+/g, ' ');
}
