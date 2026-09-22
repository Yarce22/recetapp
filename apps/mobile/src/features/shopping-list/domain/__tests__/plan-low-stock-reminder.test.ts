import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { planLowStockReminder } from '@/features/shopping-list/domain/plan-low-stock-reminder';

function entry(name: string, amount: number, threshold: number | null): PantryEntry {
  const id = name.toLowerCase();
  return {
    ingredient: createIngredient({ id, name, category: 'other', defaultUnit: 'g' }),
    item: createPantryItem({
      ingredientId: id,
      quantity: makeQuantity(amount, 'g'),
      lowStockThreshold: threshold === null ? null : makeQuantity(threshold, 'g'),
    }),
  };
}

const low = (name: string) => entry(name, 10, 500);
const plenty = (name: string) => entry(name, 900, 500);

describe('planLowStockReminder', () => {
  it('says nothing when nothing is low', () => {
    expect(planLowStockReminder([plenty('Flour')])).toBeNull();
  });

  it('says nothing for an empty pantry, rather than an empty reminder', () => {
    expect(planLowStockReminder([])).toBeNull();
  });

  it('names the single ingredient that ran low', () => {
    const reminder = planLowStockReminder([low('Flour'), plenty('Sugar')]);

    expect(reminder?.body).toBe('Flour is running low.');
  });

  it('lists a handful by name, because a count alone is not actionable', () => {
    const reminder = planLowStockReminder([low('Flour'), low('Sugar'), low('Rice')]);

    expect(reminder?.body).toBe('Flour, Sugar and Rice are running low.');
  });

  it('stops naming after three and counts the rest, to stay readable', () => {
    const reminder = planLowStockReminder([
      low('Flour'),
      low('Sugar'),
      low('Rice'),
      low('Salt'),
      low('Oil'),
    ]);

    expect(reminder?.body).toBe('Flour, Sugar, Rice and 2 more are running low.');
  });

  it('uses the name the user typed', () => {
    const reminder = planLowStockReminder([low('Harina de trigo')]);

    expect(reminder?.body).toContain('Harina de trigo');
  });

  it('carries a title that says what the notification is about', () => {
    const reminder = planLowStockReminder([low('Flour')]);

    expect(reminder?.title).toBe('Time to restock');
  });
});
