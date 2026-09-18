import type { PreferencesDto, RecipeDto, RecipeResponse } from '@recetapp/contracts';

import { createApp } from '../../app.ts';
import type { SuggestionEngine } from '../../app.ts';
import { MalformedModelResponseError } from '../../gemini/suggestion-schema.ts';
import { createRateLimiter } from '../../policy/rate-limit.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['salt'],
  dietary: [],
  dislikes: [],
};

const recipe: RecipeDto = {
  id: 'tomato-salad',
  title: 'Tomato salad',
  servings: 2,
  ingredients: [
    { name: 'tomato', quantity: { amount: 400, unit: 'g' }, optional: false },
    { name: 'salt', quantity: { amount: 1, unit: 'pinch' }, optional: false },
  ],
  steps: ['Chop.', 'Serve.'],
  timeMinutes: 10,
  difficulty: 'easy',
};

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Tomato salad',
    pantry: [{ name: 'Tomato', quantity: { amount: 500, unit: 'g' } }],
    preferences,
    ...overrides,
  });

function setup(engine: Partial<SuggestionEngine>) {
  return createApp({
    engine: {
      suggest: async () => [],
      recipe: async () => recipe,
      ...engine,
    } as SuggestionEngine,
    limiter: createRateLimiter({ perDevicePerHour: 10, globalPerHour: 100, now: () => 0 }),
  });
}

const post = (
  app: ReturnType<typeof createApp>,
  path = '/recipes/tomato-salad',
  init: RequestInit = {},
) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': 'device-a' },
    body: body(),
    ...init,
  });

describe('POST /recipes/:id', () => {
  it('returns the recipe with what the pantry cannot cover', async () => {
    const app = setup({});

    const response = await post(app);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as RecipeResponse;
    expect(payload.recipe.title).toBe('Tomato salad');
    // tomato is in the pantry, salt is an enabled staple.
    expect(payload.missingIngredients).toEqual([]);
  });

  it('names what is missing when the pantry does not cover the recipe', async () => {
    const app = setup({
      recipe: async () => ({
        ...recipe,
        ingredients: [
          ...recipe.ingredients,
          { name: 'basil', quantity: { amount: 5, unit: 'g' }, optional: false },
        ],
      }),
    });

    const payload = (await (await post(app)).json()) as RecipeResponse;
    expect(payload.missingIngredients).toEqual(['basil']);
  });

  it('rejects an id that does not match the title, since the pair must agree', async () => {
    const app = setup({});

    const response = await post(app, '/recipes/something-else');
    expect(response.status).toBe(400);
  });

  it('refuses a recipe that contains a disliked ingredient', async () => {
    // The dish passed the suggestion filter. The full ingredient list did not.
    const app = setup({
      recipe: async () => ({
        ...recipe,
        ingredients: [
          ...recipe.ingredients,
          { name: 'peanut oil', quantity: { amount: 1, unit: 'tbsp' }, optional: false },
        ],
      }),
    });

    const response = await post(app, '/recipes/tomato-salad', {
      body: body({ preferences: { ...preferences, dislikes: ['peanut'] } }),
    });

    expect(response.status).toBe(422);
  });

  it('scales the recipe when a different serving count is asked for', async () => {
    const app = setup({});

    const response = await post(app, '/recipes/tomato-salad', { body: body({ servings: 4 }) });
    const payload = (await response.json()) as RecipeResponse;

    expect(payload.recipe.servings).toBe(4);
    expect(payload.recipe.ingredients[0].quantity.amount).toBe(800);
  });

  it('rejects a nonsensical serving count', async () => {
    const app = setup({});

    const response = await post(app, '/recipes/tomato-salad', { body: body({ servings: 0 }) });
    expect(response.status).toBe(400);
  });

  it('answers 502 when the model returns something unusable', async () => {
    const app = setup({
      recipe: async () => {
        throw new MalformedModelResponseError('nope');
      },
    });

    expect((await post(app)).status).toBe(502);
  });

  it('requires a device identifier like every other route', async () => {
    const app = setup({});

    const response = await post(app, '/recipes/tomato-salad', {
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(400);
  });
});
