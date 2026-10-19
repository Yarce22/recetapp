import type { MealPlanEntryDto } from '@recetapp/contracts';

import { makeFindPlannedDish } from '@/features/meal-plan/application/find-planned-dish';
import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';

const entry = (date: string, overrides: Partial<MealPlanEntryDto> = {}): MealPlanEntryDto => ({
  date,
  slot: 'dinner',
  dishId: 'pasta',
  dishTitle: 'Pasta',
  summary: '',
  ingredients: ['pasta'],
  ...overrides,
});

const withIngredients: Partial<MealPlanEntryDto> = {
  recipeIngredients: [{ name: 'pasta', quantity: { amount: 100, unit: 'g' }, optional: false }],
};

describe('makeFindPlannedDish', () => {
  it('finds a dish by id in any week', async () => {
    const repository = new InMemoryMealPlanRepository();
    await repository.upsertMany([entry('2026-09-22'), entry('2026-11-03', { dishId: 'soup' })]);

    const found = await makeFindPlannedDish(repository)('soup');

    expect(found?.date).toBe('2026-11-03');
  });

  it('is undefined when the dish is not planned', async () => {
    const found = await makeFindPlannedDish(new InMemoryMealPlanRepository())('ghost');

    expect(found).toBeUndefined();
  });

  it('prefers the occurrence that carries ingredients when the dish repeats', async () => {
    const repository = new InMemoryMealPlanRepository();
    await repository.upsertMany([entry('2026-09-22'), entry('2026-09-23', withIngredients)]);

    const found = await makeFindPlannedDish(repository)('pasta');

    expect(found?.recipeIngredients).toBeDefined();
  });
});
