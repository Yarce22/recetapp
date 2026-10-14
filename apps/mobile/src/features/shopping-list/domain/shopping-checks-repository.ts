import { normalizeIngredientName } from '@recetapp/contracts';

/** A shopping list item the user has ticked. */
export type ShoppingCheck = {
  /** Normalized name; identifies the item across devices. */
  key: string;
  /** As shown to the user. */
  name: string;
};

/** The key a list item is ticked under. */
export function shoppingCheckKey(name: string): string {
  return normalizeIngredientName(name);
}

/**
 * Port for the ticks on the shopping list.
 *
 * The list is derived from the pantry and the plan, so only the ticks are
 * stored. Unticking removes the row; in a household that becomes a tombstone.
 */
export interface ShoppingChecksRepository {
  findAll(): Promise<ShoppingCheck[]>;
  check(item: ShoppingCheck): Promise<void>;
  uncheck(key: string): Promise<void>;
}
