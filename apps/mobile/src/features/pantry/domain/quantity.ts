import type { Quantity } from '@recetapp/contracts';

import { IncompatibleUnitsError, InvalidQuantityError } from './errors';
import { canConvert, factorOf, type Unit } from './units';

export type { Quantity };

/**
 * Floating point arithmetic on unit factors produces noise like
 * 0.30000000000000004. Amounts are rounded to a precision far finer than any
 * kitchen scale, which removes the noise without losing anything real.
 */
const PRECISION = 6;

function round(amount: number): number {
  return Number(amount.toFixed(PRECISION));
}

export function makeQuantity(amount: number, unit: Unit): Quantity {
  if (!Number.isFinite(amount)) {
    throw new InvalidQuantityError(`Amount must be a finite number, got ${amount}.`);
  }
  if (amount < 0) {
    throw new InvalidQuantityError(`Amount cannot be negative, got ${amount}.`);
  }
  return { amount: round(amount), unit };
}

export function convertQuantity(quantity: Quantity, to: Unit): Quantity {
  if (quantity.unit === to) return quantity;
  if (!canConvert(quantity.unit, to)) {
    throw new IncompatibleUnitsError(quantity.unit, to);
  }
  const inBaseUnits = quantity.amount * factorOf(quantity.unit);
  return makeQuantity(inBaseUnits / factorOf(to), to);
}

/** Adds `b` to `a`, expressing the result in the unit of `a`. */
export function addQuantities(a: Quantity, b: Quantity): Quantity {
  const converted = convertQuantity(b, a.unit);
  return makeQuantity(a.amount + converted.amount, a.unit);
}

/**
 * Subtracts `b` from `a`, expressing the result in the unit of `a`.
 *
 * The result is clamped at zero: a pantry can be empty, but it cannot hold a
 * negative amount of flour. Taking more than there is leaves nothing, which is
 * what actually happens in a kitchen.
 */
export function subtractQuantities(a: Quantity, b: Quantity): Quantity {
  const converted = convertQuantity(b, a.unit);
  return makeQuantity(Math.max(0, a.amount - converted.amount), a.unit);
}

/** True when `a` is less than or equal to `b`, comparing in the unit of `b`. */
export function isAtOrBelow(a: Quantity, b: Quantity): boolean {
  const converted = convertQuantity(a, b.unit);
  return converted.amount <= b.amount;
}
