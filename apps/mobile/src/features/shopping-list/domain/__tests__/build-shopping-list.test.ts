import type { MealPlanEntryDto } from '@recetapp/contracts';

import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { buildShoppingList } from '@/features/shopping-list/domain/build-shopping-list';

function pantryEntry(name: string, amount: number, threshold: number | null): PantryEntry {
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

function planEntry(dishTitle: string, ingredients: string[]): MealPlanEntryDto {
  return {
    date: '2026-09-21',
    slot: 'dinner',
    dishId: dishTitle.toLowerCase().replace(/\s+/g, '-'),
    dishTitle,
    summary: '',
    ingredients,
  };
}

const preferences = { ...DEFAULT_PREFERENCES, staples: ['salt', 'water'] };

describe('buildShoppingList', () => {
  it('is empty when the pantry covers everything the week needs', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 500, 100)],
      planEntries: [planEntry('Tomato salad', ['tomato'])],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('is empty when no menu is planned, even if the pantry is running low', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 50, 500)],
      planEntries: [],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('lists what the week needs and the pantry does not have', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 500, null)],
      planEntries: [planEntry('Pasta', ['tomato', 'pasta'])],
      preferences,
    });

    expect(list).toEqual([{ name: 'pasta', neededFor: ['Pasta'] }]);
  });

  it('ignores a low item the menu does not use', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 10, 500)],
      planEntries: [planEntry('Pasta', ['pasta'])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['pasta']);
  });

  it('lists a planned ingredient the pantry holds but has run low on', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Tomato', 50, 500)],
      planEntries: [planEntry('Pasta', ['tomato'])],
      preferences,
    });

    expect(list).toEqual([{ name: 'Tomato', neededFor: ['Pasta'] }]);
  });

  it('never asks you to buy a staple you said is always there', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Boiled egg', ['salt', 'water'])],
      preferences,
    });

    expect(list).toEqual([]);
  });

  it('says which dishes need an ingredient, so the list explains itself', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Pasta', ['pasta']), planEntry('Lasagna', ['pasta'])],
      preferences,
    });

    expect(list[0].neededFor).toEqual(['Pasta', 'Lasagna']);
  });

  it('does not repeat a dish that uses the same ingredient twice', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Pasta', ['pasta', 'Pasta'])],
      preferences,
    });

    expect(list[0].neededFor).toEqual(['Pasta']);
  });

  it('matches across spellings, so an accent does not create a second row', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Limón', 10, 100)],
      planEntries: [planEntry('Lemonade', ['limon'])],
      preferences,
    });

    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Limón');
  });

  it('sorts alphabetically, so the list is stable', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Stew', ['onion', 'beef', 'carrot'])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['beef', 'carrot', 'onion']);
  });
});

describe('buildShoppingList based on low stock', () => {
  const lowStock = { source: 'low-stock' as const };

  it('lists the pantry items that reached their low-stock threshold', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 50, 500), pantryEntry('Rice', 900, 500)],
      planEntries: [],
      preferences,
      ...lowStock,
    });

    expect(list).toEqual([{ name: 'Flour', neededFor: [] }]);
  });

  it('ignores an item with no threshold, since the user never asked to be warned', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 1, null)],
      planEntries: [],
      preferences,
      ...lowStock,
    });

    expect(list).toEqual([]);
  });

  it('ignores the menu, even for ingredients the pantry lacks', () => {
    const list = buildShoppingList({
      pantry: [],
      planEntries: [planEntry('Pasta', ['pasta'])],
      preferences,
      ...lowStock,
    });

    expect(list).toEqual([]);
  });

  it('sorts alphabetically, so the list is stable', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Salt', 1, 5), pantryEntry('Flour', 1, 5)],
      planEntries: [],
      preferences,
      ...lowStock,
    });

    expect(list.map((item) => item.name)).toEqual(['Flour', 'Salt']);
  });

  it('keeps using the menu when no source is given', () => {
    const list = buildShoppingList({
      pantry: [pantryEntry('Flour', 1, 5)],
      planEntries: [planEntry('Pasta', ['pasta'])],
      preferences,
    });

    expect(list.map((item) => item.name)).toEqual(['pasta']);
  });
});
