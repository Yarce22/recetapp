import type { IngredientCategory } from '../domain/ingredient';
import { createIngredient } from '../domain/ingredient';
import { createPantryItem } from '../domain/pantry-item';
import type { PantryEntry } from '../domain/pantry-repository';
import { makeQuantity } from '../domain/quantity';
import type { Unit } from '../domain/units';

/** One row of the `pantry_items` table. */
export type PantryRow = {
  ingredient_id: string;
  display_name: string;
  category: string;
  default_unit: string;
  amount: number;
  unit: string;
  threshold_amount: number | null;
  threshold_unit: string | null;
  /** Epoch milliseconds, or null when the item has no expiry. */
  expires_at: number | null;
};

export function entryToRow(entry: PantryEntry): PantryRow {
  const { ingredient, item } = entry;

  return {
    ingredient_id: ingredient.id,
    display_name: ingredient.displayName,
    category: ingredient.category,
    default_unit: ingredient.defaultUnit,
    amount: item.quantity.amount,
    unit: item.quantity.unit,
    threshold_amount: item.lowStockThreshold?.amount ?? null,
    threshold_unit: item.lowStockThreshold?.unit ?? null,
    expires_at: item.expiresAt?.getTime() ?? null,
  };
}

/**
 * Rebuilds a domain entry from a row.
 *
 * Goes through the domain factories rather than assembling object literals, so
 * a row that violates an invariant fails here instead of flowing into the app
 * as a malformed entry.
 */
export function rowToEntry(row: PantryRow): PantryEntry {
  const threshold =
    row.threshold_amount !== null && row.threshold_unit !== null
      ? makeQuantity(row.threshold_amount, row.threshold_unit as Unit)
      : null;

  return {
    ingredient: createIngredient({
      id: row.ingredient_id,
      name: row.display_name,
      category: row.category as IngredientCategory,
      defaultUnit: row.default_unit as Unit,
    }),
    item: createPantryItem({
      ingredientId: row.ingredient_id,
      quantity: makeQuantity(row.amount, row.unit as Unit),
      lowStockThreshold: threshold,
      expiresAt: row.expires_at !== null ? new Date(row.expires_at) : null,
    }),
  };
}
