import { findForbiddenIngredients, findMissingIngredients, scaleRecipe } from '../recipe-rules.ts';
import type { PreferencesDto, RecipeDto } from '../types.ts';

const preferences = (overrides: Partial<PreferencesDto> = {}): PreferencesDto => ({
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['salt', 'water'],
  dietary: [],
  dislikes: [],
  ...overrides,
});

const recipe = (overrides: Partial<RecipeDto> = {}): RecipeDto => ({
  id: 'tomato-salad',
  title: 'Tomato salad',
  servings: 2,
  ingredients: [
    { name: 'tomato', quantity: { amount: 400, unit: 'g' }, optional: false },
    { name: 'olive oil', quantity: { amount: 2, unit: 'tbsp' }, optional: false },
  ],
  steps: ['Chop the tomatoes.', 'Dress and serve.'],
  timeMinutes: 10,
  difficulty: 'easy',
  ...overrides,
});

describe('findForbiddenIngredients', () => {
  it('finds nothing when there are no dislikes', () => {
    expect(findForbiddenIngredients(['tomato', 'peanut'], preferences())).toEqual([]);
  });

  it('finds a disliked ingredient regardless of spelling', () => {
    expect(findForbiddenIngredients(['Maní'], preferences({ dislikes: ['mani'] }))).toEqual([
      'Maní',
    ]);
  });

  it('matches as a substring, so avoiding peanut also catches peanut butter', () => {
    expect(
      findForbiddenIngredients(['peanut butter'], preferences({ dislikes: ['peanut'] })),
    ).toEqual(['peanut butter']);
  });

  it('ignores blank dislike entries rather than matching everything', () => {
    expect(findForbiddenIngredients(['tomato'], preferences({ dislikes: ['', '   '] }))).toEqual(
      [],
    );
  });
});

describe('findMissingIngredients', () => {
  it('returns what the pantry does not have', () => {
    expect(findMissingIngredients(['tomato', 'pasta'], ['Tomato'], preferences())).toEqual([
      'pasta',
    ]);
  });

  it('treats enabled staples as available', () => {
    expect(findMissingIngredients(['tomato', 'salt'], ['Tomato'], preferences())).toEqual([]);
  });

  it('matches across spellings', () => {
    expect(findMissingIngredients(['limon'], ['Limón'], preferences())).toEqual([]);
  });
});

describe('scaleRecipe', () => {
  it('leaves a recipe untouched when the servings do not change', () => {
    expect(scaleRecipe(recipe(), 2)).toEqual(recipe());
  });

  it('doubles every quantity when the servings double', () => {
    const scaled = scaleRecipe(recipe(), 4);

    expect(scaled.servings).toBe(4);
    expect(scaled.ingredients[0].quantity).toEqual({ amount: 800, unit: 'g' });
    expect(scaled.ingredients[1].quantity).toEqual({ amount: 4, unit: 'tbsp' });
  });

  it('halves quantities when the servings halve', () => {
    const scaled = scaleRecipe(recipe(), 1);

    expect(scaled.ingredients[0].quantity.amount).toBe(200);
  });

  it('keeps the steps and the title as they are', () => {
    const scaled = scaleRecipe(recipe(), 6);

    expect(scaled.steps).toEqual(recipe().steps);
    expect(scaled.title).toBe('Tomato salad');
  });

  it('rounds to something a kitchen can act on', () => {
    const scaled = scaleRecipe(
      recipe({
        ingredients: [{ name: 'x', quantity: { amount: 100, unit: 'g' }, optional: false }],
      }),
      3,
    );

    expect(scaled.ingredients[0].quantity.amount).toBe(150);
  });

  it('never scales an ingredient down to nothing', () => {
    const tiny = recipe({
      servings: 8,
      ingredients: [{ name: 'saffron', quantity: { amount: 0.1, unit: 'g' }, optional: false }],
    });

    const scaled = scaleRecipe(tiny, 1);
    expect(scaled.ingredients[0].quantity.amount).toBeGreaterThan(0);
  });

  it('refuses a servings count that makes no sense', () => {
    expect(() => scaleRecipe(recipe(), 0)).toThrow();
    expect(() => scaleRecipe(recipe(), -2)).toThrow();
  });

  it('refuses to scale a recipe that claims zero servings', () => {
    expect(() => scaleRecipe(recipe({ servings: 0 }), 4)).toThrow();
  });
});
