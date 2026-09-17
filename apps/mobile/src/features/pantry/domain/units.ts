import type { Unit } from '@recetapp/contracts';

export type { Unit };

/**
 * What a unit actually measures. Conversion is only ever allowed inside a
 * single dimension.
 *
 * `imprecise` covers units with no agreed magnitude. A pinch is a gesture, not
 * a measurement, so it never converts to anything.
 */
export type Dimension = 'mass' | 'volume' | 'count' | 'imprecise';

type UnitSpec = {
  dimension: Dimension;
  /** How many base units of the dimension one of this unit represents. */
  factor: number;
};

/**
 * Cooking volumes use the metric conventions (tsp 5 ml, tbsp 15 ml, cup
 * 240 ml). They are approximations by nature - spoons vary - but they are the
 * approximations recipes are written against.
 */
const UNITS: Record<Unit, UnitSpec> = {
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  tsp: { dimension: 'volume', factor: 5 },
  tbsp: { dimension: 'volume', factor: 15 },
  cup: { dimension: 'volume', factor: 240 },
  unit: { dimension: 'count', factor: 1 },
  pinch: { dimension: 'imprecise', factor: 1 },
};

export function dimensionOf(unit: Unit): Dimension {
  return UNITS[unit].dimension;
}

export function factorOf(unit: Unit): number {
  return UNITS[unit].factor;
}

/**
 * True when a value in `from` can be expressed in `to`.
 *
 * Identical units are always convertible. Beyond that, both units must share a
 * dimension, and that dimension must not be `imprecise`.
 */
export function canConvert(from: Unit, to: Unit): boolean {
  if (from === to) return true;
  const a = dimensionOf(from);
  if (a === 'imprecise') return false;
  return a === dimensionOf(to);
}
