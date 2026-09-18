import { parseModelRecipe } from '../recipe-schema.ts';
import { MalformedModelResponseError } from '../suggestion-schema.ts';

const valid = {
  title: 'Tomato salad',
  servings: 2,
  timeMinutes: 10,
  difficulty: 'easy',
  ingredients: [{ name: 'tomato', amount: 400, unit: 'g', optional: false }],
  steps: ['Chop the tomatoes.', 'Dress and serve.'],
};

describe('parseModelRecipe', () => {
  it('maps a well formed recipe', () => {
    const recipe = parseModelRecipe(valid);

    expect(recipe.title).toBe('Tomato salad');
    expect(recipe.ingredients[0].quantity).toEqual({ amount: 400, unit: 'g' });
    expect(recipe.steps).toHaveLength(2);
  });

  it('derives the same id the suggestion had, so the two refer to one dish', () => {
    expect(parseModelRecipe(valid).id).toBe('tomato-salad');
  });

  it('rejects a recipe with no steps, which is not a recipe', () => {
    expect(() => parseModelRecipe({ ...valid, steps: [] })).toThrow(MalformedModelResponseError);
  });

  it('rejects a recipe with no ingredients', () => {
    expect(() => parseModelRecipe({ ...valid, ingredients: [] })).toThrow(
      MalformedModelResponseError,
    );
  });

  it('rejects zero servings, which would make scaling undefined', () => {
    expect(() => parseModelRecipe({ ...valid, servings: 0 })).toThrow(MalformedModelResponseError);
  });

  it('rejects an amount that is not usable arithmetic', () => {
    expect(() =>
      parseModelRecipe({
        ...valid,
        ingredients: [{ name: 'tomato', amount: 'a handful', unit: 'g', optional: false }],
      }),
    ).toThrow(MalformedModelResponseError);
  });

  it('rejects a unit we do not understand', () => {
    expect(() =>
      parseModelRecipe({
        ...valid,
        ingredients: [{ name: 'tomato', amount: 2, unit: 'scoops', optional: false }],
      }),
    ).toThrow(MalformedModelResponseError);
  });

  it('rejects prose instead of a recipe', () => {
    expect(() => parseModelRecipe('I cannot help with that')).toThrow(MalformedModelResponseError);
  });

  it('defaults optional to required when the model omits it', () => {
    const recipe = parseModelRecipe({
      ...valid,
      ingredients: [{ name: 'tomato', amount: 400, unit: 'g' }],
    });

    expect(recipe.ingredients[0].optional).toBe(false);
  });
});
