import type { Quantity } from '../domain/quantity';

/**
 * Formats a quantity for display.
 *
 * Trailing zeros are dropped so a whole amount reads "500 g" rather than
 * "500.000000 g".
 */
export function formatQuantity(quantity: Quantity): string {
  const amount = Number(quantity.amount.toFixed(2));
  return `${amount} ${quantity.unit}`;
}
