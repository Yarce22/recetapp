import type { MealPlanEntryDto, RecipeDto } from '@recetapp/contracts';

import { PLAN_SERVINGS } from '@/features/meal-plan/domain/plan-servings';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { resolveRecipe } from '@/features/recipes/application/resolve-recipe';
import type {
  RecipeRequestInput,
  RecipeSuggestionService,
} from '@/features/recipes/domain/recipe-suggestion-service';

const serverRecipe: RecipeDto = {
  id: 'pasta',
  title: 'Pasta',
  servings: 4,
  ingredients: [{ name: 'spaghetti', quantity: { amount: 500, unit: 'g' }, optional: false }],
  steps: ['Boil.'],
  timeMinutes: 20,
  difficulty: 'easy',
};

const entry: MealPlanEntryDto = {
  date: '2026-09-22',
  slot: 'dinner',
  dishId: 'pasta',
  dishTitle: 'Pasta',
  summary: '',
  ingredients: ['pasta', 'tomato'],
  recipeIngredients: [
    { name: 'pasta', quantity: { amount: 100, unit: 'g' }, optional: false },
    { name: 'tomato', quantity: { amount: 1, unit: 'unit' }, optional: false },
  ],
};

function fakeService(recipe: RecipeDto = serverRecipe) {
  const calls: RecipeRequestInput[] = [];
  const service = {
    recipe: async (input: RecipeRequestInput) => {
      calls.push(input);
      return { recipe, missingIngredients: ['spaghetti'] };
    },
  } as unknown as RecipeSuggestionService;
  return { service, calls };
}

const base = { id: 'pasta', title: 'Pasta', pantry: [], preferences: DEFAULT_PREFERENCES };

describe('resolveRecipe', () => {
  it('passes the server recipe through when the dish has no stored ingredients', async () => {
    const { service, calls } = fakeService();

    const result = await resolveRecipe(service, base);

    expect(result.recipe).toEqual(serverRecipe);
    expect(result.missingIngredients).toEqual(['spaghetti']);
    expect(calls[0].servings).toBeUndefined();
  });

  it('shows the ingredients stored with the menu, scaled to the recipe servings', async () => {
    const { service } = fakeService();

    const result = await resolveRecipe(service, { ...base, planEntry: entry, servings: 4 });

    expect(result.recipe.ingredients).toEqual([
      { name: 'pasta', quantity: { amount: 400, unit: 'g' }, optional: false },
      { name: 'tomato', quantity: { amount: 4, unit: 'unit' }, optional: false },
    ]);
    // What the menu does not carry still comes from the server.
    expect(result.recipe.steps).toEqual(['Boil.']);
    expect(result.recipe.timeMinutes).toBe(20);
  });

  it('asks for the plan servings so the recipe agrees with the shopping list', async () => {
    const { service, calls } = fakeService({ ...serverRecipe, servings: PLAN_SERVINGS });

    await resolveRecipe(service, { ...base, planEntry: entry });

    expect(calls[0].servings).toBe(PLAN_SERVINGS);
  });

  it('keeps an explicit servings choice over the plan default', async () => {
    const { service, calls } = fakeService();

    await resolveRecipe(service, { ...base, planEntry: entry, servings: 6 });

    expect(calls[0].servings).toBe(6);
  });

  it('recomputes what is missing from the stored ingredients, not the server ones', async () => {
    const { service } = fakeService();
    const pantry = [
      {
        ingredient: {
          id: 'pasta',
          name: 'pasta',
          displayName: 'Pasta',
          category: 'other',
          defaultUnit: 'g',
        },
      },
    ] as unknown as PantryEntry[];

    const result = await resolveRecipe(service, { ...base, pantry, planEntry: entry, servings: 4 });

    expect(result.missingIngredients).toEqual(['tomato']);
  });
});
