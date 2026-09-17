import {
  addQuantities,
  convertQuantity,
  isAtOrBelow,
  makeQuantity,
  subtractQuantities,
} from '@/features/pantry/domain/quantity';
import { IncompatibleUnitsError, InvalidQuantityError } from '@/features/pantry/domain/errors';

describe('makeQuantity', () => {
  it('builds a quantity from an amount and a unit', () => {
    expect(makeQuantity(500, 'g')).toEqual({ amount: 500, unit: 'g' });
  });

  it('accepts zero, because running out is a real state', () => {
    expect(makeQuantity(0, 'g').amount).toBe(0);
  });

  it('rejects a negative amount', () => {
    expect(() => makeQuantity(-1, 'g')).toThrow(InvalidQuantityError);
  });

  it('rejects an amount that is not a finite number', () => {
    expect(() => makeQuantity(Number.NaN, 'g')).toThrow(InvalidQuantityError);
    expect(() => makeQuantity(Number.POSITIVE_INFINITY, 'g')).toThrow(InvalidQuantityError);
  });
});

describe('convertQuantity', () => {
  it('converts within mass', () => {
    expect(convertQuantity(makeQuantity(2, 'kg'), 'g')).toEqual({ amount: 2000, unit: 'g' });
  });

  it('converts within volume, including cooking units', () => {
    expect(convertQuantity(makeQuantity(1, 'l'), 'ml')).toEqual({ amount: 1000, unit: 'ml' });
    expect(convertQuantity(makeQuantity(1, 'tbsp'), 'ml')).toEqual({ amount: 15, unit: 'ml' });
    expect(convertQuantity(makeQuantity(1, 'cup'), 'ml')).toEqual({ amount: 240, unit: 'ml' });
  });

  it('is a no-op when the unit already matches', () => {
    expect(convertQuantity(makeQuantity(3, 'unit'), 'unit')).toEqual({ amount: 3, unit: 'unit' });
  });

  it('refuses to convert across dimensions', () => {
    expect(() => convertQuantity(makeQuantity(100, 'g'), 'ml')).toThrow(IncompatibleUnitsError);
    expect(() => convertQuantity(makeQuantity(2, 'unit'), 'g')).toThrow(IncompatibleUnitsError);
  });

  it('refuses to convert an imprecise unit, even to another imprecise one', () => {
    expect(() => convertQuantity(makeQuantity(1, 'pinch'), 'g')).toThrow(IncompatibleUnitsError);
  });
});

describe('addQuantities', () => {
  it('adds two quantities in the same unit', () => {
    expect(addQuantities(makeQuantity(200, 'g'), makeQuantity(300, 'g'))).toEqual({
      amount: 500,
      unit: 'g',
    });
  });

  it('adds across compatible units, keeping the unit of the left operand', () => {
    expect(addQuantities(makeQuantity(1, 'kg'), makeQuantity(500, 'g'))).toEqual({
      amount: 1.5,
      unit: 'kg',
    });
  });

  it('refuses to add across dimensions', () => {
    expect(() => addQuantities(makeQuantity(1, 'kg'), makeQuantity(1, 'l'))).toThrow(
      IncompatibleUnitsError,
    );
  });
});

describe('subtractQuantities', () => {
  it('subtracts across compatible units', () => {
    expect(subtractQuantities(makeQuantity(1, 'kg'), makeQuantity(250, 'g'))).toEqual({
      amount: 0.75,
      unit: 'kg',
    });
  });

  it('clamps at zero rather than going negative, because a pantry cannot owe food', () => {
    expect(subtractQuantities(makeQuantity(100, 'g'), makeQuantity(300, 'g'))).toEqual({
      amount: 0,
      unit: 'g',
    });
  });
});

describe('isAtOrBelow', () => {
  it('compares across compatible units', () => {
    expect(isAtOrBelow(makeQuantity(200, 'g'), makeQuantity(1, 'kg'))).toBe(true);
    expect(isAtOrBelow(makeQuantity(2, 'kg'), makeQuantity(500, 'g'))).toBe(false);
  });

  it('is true on equality', () => {
    expect(isAtOrBelow(makeQuantity(1000, 'g'), makeQuantity(1, 'kg'))).toBe(true);
  });

  it('refuses to compare across dimensions', () => {
    expect(() => isAtOrBelow(makeQuantity(1, 'unit'), makeQuantity(1, 'g'))).toThrow(
      IncompatibleUnitsError,
    );
  });
});
