/**
 * What the shopping list is built from.
 *
 * `menu`      - what the week's menu needs and the pantry does not cover
 * `low-stock` - the pantry items that reached the low-stock threshold the user set
 */
export type ShoppingSource = 'menu' | 'low-stock';

export const DEFAULT_SHOPPING_SOURCE: ShoppingSource = 'menu';

export const SHOPPING_SOURCE_SETTING_KEY = 'shopping-source';

/**
 * Reads a stored choice.
 *
 * Stored settings are not trusted: anything unrecognised falls back to the
 * default rather than leaving the list with no source at all.
 */
export function parseShoppingSource(raw: string | null | undefined): ShoppingSource {
  return raw === 'menu' || raw === 'low-stock' ? raw : DEFAULT_SHOPPING_SOURCE;
}
