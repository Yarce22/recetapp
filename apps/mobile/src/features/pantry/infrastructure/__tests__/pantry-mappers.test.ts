import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { entryToRow, rowToEntry } from '@/features/pantry/infrastructure/pantry-mappers';

const entry: PantryEntry = {
  ingredient: createIngredient({
    id: 'tomato',
    name: 'Tomato',
    category: 'produce',
    defaultUnit: 'g',
  }),
  item: createPantryItem({
    ingredientId: 'tomato',
    quantity: makeQuantity(500, 'g'),
    lowStockThreshold: makeQuantity(100, 'g'),
    expiresAt: new Date('2026-10-01T00:00:00Z'),
  }),
};

describe('pantry mappers', () => {
  it('round-trips an entry through the row representation', () => {
    expect(rowToEntry(entryToRow(entry))).toEqual(entry);
  });

  it('stores dates as epoch milliseconds', () => {
    expect(entryToRow(entry).expires_at).toBe(new Date('2026-10-01T00:00:00Z').getTime());
  });

  it('round-trips an entry with no threshold and no expiry', () => {
    const minimal: PantryEntry = {
      ingredient: createIngredient({
        id: 'salt',
        name: 'Salt',
        category: 'spice',
        defaultUnit: 'g',
      }),
      item: createPantryItem({
        ingredientId: 'salt',
        quantity: makeQuantity(1, 'kg'),
        lowStockThreshold: null,
        expiresAt: null,
      }),
    };

    const row = entryToRow(minimal);
    expect(row.threshold_amount).toBeNull();
    expect(row.threshold_unit).toBeNull();
    expect(row.expires_at).toBeNull();
    expect(rowToEntry(row)).toEqual(minimal);
  });
});
