import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { planLowStockReminder } from '@/features/shopping-list/domain/plan-low-stock-reminder';
import { createTranslator } from '@/shared/i18n/translator';

function low(name: string): PantryEntry {
  const id = name.toLowerCase();
  return {
    ingredient: createIngredient({ id, name, category: 'other', defaultUnit: 'g' }),
    item: createPantryItem({
      ingredientId: id,
      quantity: makeQuantity(10, 'g'),
      lowStockThreshold: makeQuantity(500, 'g'),
    }),
  };
}

const es = createTranslator('es');

describe('planLowStockReminder in Spanish', () => {
  it('names a single ingredient', () => {
    expect(planLowStockReminder([low('Harina')], es)).toEqual({
      title: 'Hora de reponer',
      body: 'Harina se está acabando.',
    });
  });

  it('joins two or three ingredients with "y"', () => {
    const reminder = planLowStockReminder([low('Harina'), low('Azúcar'), low('Arroz')], es);

    expect(reminder?.body).toBe('Harina, Azúcar y Arroz se están acabando.');
  });

  it('counts the rest beyond the ones it names', () => {
    const reminder = planLowStockReminder(
      [low('Harina'), low('Azúcar'), low('Arroz'), low('Sal'), low('Aceite')],
      es,
    );

    expect(reminder?.body).toBe('Harina, Azúcar, Arroz y 2 más se están acabando.');
  });

  it('is still English by default', () => {
    expect(planLowStockReminder([low('Flour')])?.body).toBe('Flour is running low.');
  });
});
