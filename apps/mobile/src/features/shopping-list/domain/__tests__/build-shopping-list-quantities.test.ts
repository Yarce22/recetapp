import type { MealPlanEntryDto } from '@recetapp/contracts';

import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { buildShoppingList } from '@/features/shopping-list/domain/build-shopping-list';

const preferences = { ...DEFAULT_PREFERENCES, staples: ['salt', 'water'] };

function pantryEntry(name: string, amount: number): PantryEntry {
  const id = name.toLowerCase();
  return {
    ingredient: createIngredient({ id, name, category: 'other', defaultUnit: 'g' }),
    item: createPantryItem({
      ingredientId: id,
      quantity: makeQuantity(amount, 'g'),
      lowStockThreshold: null,
    }),
  };
}

type Line = NonNullable<MealPlanEntryDto['recipeIngredients']>[number];

const line = (name: string, amount: number, unit: 'g' | 'unit' = 'g', optional = false): Line => ({
  name,
  quantity: { amount, unit },
  optional,
});

function dish(title: string, lines: Line[], slot: 'lunch' | 'dinner' = 'dinner'): MealPlanEntryDto {
  return {
    date: '2026-09-21',
    slot,
    dishId: title.toLowerCase(),
    dishTitle: title,
    summary: '',
    ingredients: lines.map((entry) => entry.name),
    recipeIngredients: lines,
  };
}

describe('buildShoppingList with stored recipe ingredients', () => {
  it('lists the amount to buy, scaled from per-serving to the plan servings', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [dish('Pasta', [line('pasta', 100)])],
      preferences,
      servings: 3,
    });

    expect(list).toEqual([
      { name: 'pasta', neededFor: ['Pasta'], quantities: [{ amount: 300, unit: 'g' }] },
    ]);
  });

  it('adds up the same ingredient across dishes when the unit matches', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [
        dish('Pasta', [line('tomato', 1, 'unit')]),
        dish('Soup', [line('tomato', 2, 'unit')], 'lunch'),
      ],
      preferences,
      servings: 1,
    });

    expect(list).toEqual([
      { name: 'tomato', neededFor: ['Pasta', 'Soup'], quantities: [{ amount: 3, unit: 'unit' }] },
    ]);
  });

  it('keeps separate amounts when units differ rather than guessing a conversion', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [
        dish('Pasta', [line('tomato', 100)]),
        dish('Soup', [line('tomato', 2, 'unit')], 'lunch'),
      ],
      preferences,
      servings: 1,
    });

    expect(list[0].quantities).toEqual([
      { amount: 100, unit: 'g' },
      { amount: 2, unit: 'unit' },
    ]);
  });

  it('still skips staples and what the pantry covers', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 500)],
      planEntries: [dish('Pasta', [line('salt', 5), line('tomato', 100), line('pasta', 100)])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['pasta']);
  });

  it('leaves optional ingredients off the list', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [dish('Pasta', [line('pasta', 100), line('basil', 5, 'g', true)])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['pasta']);
  });

  it('falls back to the names for dishes without stored amounts', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [
        { ...dish('Rice', []), recipeIngredients: undefined, ingredients: ['rice'] },
      ],
      preferences,
    });

    expect(list).toEqual([{ name: 'rice', neededFor: ['Rice'] }]);
  });
});
