import { createPantryItem, isExpired, isLowStock } from '@/features/pantry/domain/pantry-item';
import { makeQuantity } from '@/features/pantry/domain/quantity';

const item = (overrides: Parameters<typeof createPantryItem>[0]) => createPantryItem(overrides);

describe('isLowStock', () => {
  it('is false when no threshold is set, because the user never asked to be warned', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(1, 'g'),
      lowStockThreshold: null,
    });

    expect(isLowStock(subject)).toBe(false);
  });

  it('is true when the quantity is below the threshold', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(100, 'g'),
      lowStockThreshold: makeQuantity(200, 'g'),
    });

    expect(isLowStock(subject)).toBe(true);
  });

  it('is true when the quantity equals the threshold', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(200, 'g'),
      lowStockThreshold: makeQuantity(200, 'g'),
    });

    expect(isLowStock(subject)).toBe(true);
  });

  it('compares across compatible units', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(150, 'g'),
      lowStockThreshold: makeQuantity(1, 'kg'),
    });

    expect(isLowStock(subject)).toBe(true);
  });

  it('is false when there is plenty left', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(2, 'kg'),
      lowStockThreshold: makeQuantity(200, 'g'),
    });

    expect(isLowStock(subject)).toBe(false);
  });
});

describe('isExpired', () => {
  const now = new Date('2026-09-17T12:00:00Z');

  it('is false when no expiry date is set', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(1, 'unit'),
      lowStockThreshold: null,
      expiresAt: null,
    });

    expect(isExpired(subject, now)).toBe(false);
  });

  it('is true once the expiry date has passed', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(1, 'unit'),
      lowStockThreshold: null,
      expiresAt: new Date('2026-09-16T12:00:00Z'),
    });

    expect(isExpired(subject, now)).toBe(true);
  });

  it('is false on the expiry date itself, since the food is still good that day', () => {
    const subject = item({
      ingredientId: 'ing-1',
      quantity: makeQuantity(1, 'unit'),
      lowStockThreshold: null,
      expiresAt: new Date('2026-09-17T23:59:00Z'),
    });

    expect(isExpired(subject, now)).toBe(false);
  });
});

describe('createPantryItem', () => {
  it('refuses a threshold that cannot be compared with the quantity', () => {
    expect(() =>
      item({
        ingredientId: 'ing-1',
        quantity: makeQuantity(1, 'unit'),
        lowStockThreshold: makeQuantity(100, 'g'),
      }),
    ).toThrow();
  });
});
