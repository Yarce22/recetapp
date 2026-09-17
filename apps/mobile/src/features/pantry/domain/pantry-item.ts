import type { IngredientId } from './ingredient';
import { convertQuantity, isAtOrBelow, type Quantity } from './quantity';

export type PantryItem = {
  ingredientId: IngredientId;
  quantity: Quantity;
  /** When set, the item is flagged once the quantity reaches it. */
  lowStockThreshold: Quantity | null;
  expiresAt: Date | null;
};

export type CreatePantryItemInput = {
  ingredientId: IngredientId;
  quantity: Quantity;
  lowStockThreshold: Quantity | null;
  expiresAt?: Date | null;
};

/**
 * Builds a pantry item, rejecting a threshold that cannot be compared with the
 * quantity.
 *
 * Validating at construction means `isLowStock` can never fail later: an item
 * that exists is an item whose alert can always be evaluated.
 */
export function createPantryItem(input: CreatePantryItemInput): PantryItem {
  if (input.lowStockThreshold !== null) {
    // Throws IncompatibleUnitsError when the two cannot be related.
    convertQuantity(input.lowStockThreshold, input.quantity.unit);
  }

  return {
    ingredientId: input.ingredientId,
    quantity: input.quantity,
    lowStockThreshold: input.lowStockThreshold,
    expiresAt: input.expiresAt ?? null,
  };
}

/**
 * True when the item has a threshold and has reached it.
 *
 * With no threshold the answer is false: the user never asked to be warned
 * about this ingredient, and inventing an alert would be noise.
 */
export function isLowStock(item: PantryItem): boolean {
  if (item.lowStockThreshold === null) return false;
  return isAtOrBelow(item.quantity, item.lowStockThreshold);
}

/**
 * True once the expiry date has passed.
 *
 * The expiry date itself is not expired: food marked "use by the 17th" is
 * still good on the 17th.
 */
export function isExpired(item: PantryItem, now: Date): boolean {
  if (item.expiresAt === null) return false;
  return item.expiresAt.getTime() < now.getTime();
}
