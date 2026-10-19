import {
  RateLimitedError,
  RecipeRejectedError,
  SuggestionServiceError,
} from '@/features/recipes/domain/recipe-suggestion-service';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';

const pantry: PantryEntry[] = [
  {
    ingredient: createIngredient({
      id: 'tomato',
      name: 'Tomato',
      category: 'produce',
      defaultUnit: 'g',
    }),
    item: createPantryItem({
      ingredientId: 'tomato',
      quantity: makeQuantity(500, 'g'),
      lowStockThreshold: null,
    }),
  },
];

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(fetchImpl: typeof fetch) {
  return createHttpRecipeSuggestionService({
    baseUrl: 'http://localhost:8787',
    deviceId: 'device-a',
    fetchImpl,
  });
}

describe('http recipe suggestion service', () => {
  it('sends the pantry, the preferences and the device identifier', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const service = setup(async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return jsonResponse({ suggestions: [], filteredOut: 0 });
    });

    await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(seen!.url).toBe('http://localhost:8787/suggestions');
    expect((seen!.init.headers as Record<string, string>)['x-device-id']).toBe('device-a');

    const body = JSON.parse(String(seen!.init.body));
    expect(body.pantry).toEqual([{ name: 'Tomato', quantity: { amount: 500, unit: 'g' } }]);
    expect(body.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns the suggestions the server kept', async () => {
    const service = setup(async () =>
      jsonResponse({
        suggestions: [
          {
            id: 'tomato-salad',
            title: 'Tomato salad',
            summary: 'x',
            matchedIngredients: ['tomato'],
            missingIngredients: [],
            coverage: 1,
            mode: 'strict',
          },
        ],
        filteredOut: 2,
      }),
    );

    const result = await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(result.suggestions).toHaveLength(1);
    expect(result.filteredOut).toBe(2);
  });

  it('raises a distinct error when the server rate-limits, so the UI can say wait', async () => {
    const service = setup(async () =>
      jsonResponse({ error: 'rate_limited' }, 429, { 'retry-after': '120' }),
    );

    await expect(service.suggest(pantry, DEFAULT_PREFERENCES)).rejects.toThrow(RateLimitedError);
  });

  it('carries the retry delay the server asked for', async () => {
    const service = setup(async () =>
      jsonResponse({ error: 'rate_limited' }, 429, { 'retry-after': '120' }),
    );

    await expect(service.suggest(pantry, DEFAULT_PREFERENCES)).rejects.toMatchObject({
      retryAfterSeconds: 120,
    });
  });

  it('raises a service error on any other failure status', async () => {
    const service = setup(async () => jsonResponse({ error: 'upstream_failed' }, 502));

    await expect(service.suggest(pantry, DEFAULT_PREFERENCES)).rejects.toThrow(
      SuggestionServiceError,
    );
  });

  it('raises a service error when the network itself fails', async () => {
    const service = setup(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(service.suggest(pantry, DEFAULT_PREFERENCES)).rejects.toThrow(
      SuggestionServiceError,
    );
  });

  it('raises a service error when the body is not the shape we expect', async () => {
    const service = setup(async () => jsonResponse({ nonsense: true }));

    await expect(service.suggest(pantry, DEFAULT_PREFERENCES)).rejects.toThrow(
      SuggestionServiceError,
    );
  });
});

const recipePayload = {
  recipe: {
    id: 'tomato-salad',
    title: 'Tomato salad',
    servings: 2,
    ingredients: [{ name: 'tomato', quantity: { amount: 400, unit: 'g' }, optional: false }],
    steps: ['Chop.', 'Serve.'],
    timeMinutes: 10,
    difficulty: 'easy',
  },
  missingIngredients: ['basil'],
};

const recipeInput = {
  id: 'tomato-salad',
  title: 'Tomato salad',
  pantry,
  preferences: DEFAULT_PREFERENCES,
};

describe('http recipe suggestion service - recipe', () => {
  it('posts to the id path and carries the title, since the server keeps no state', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const service = setup(async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return jsonResponse(recipePayload);
    });

    await service.recipe(recipeInput);

    expect(seen!.url).toBe('http://localhost:8787/recipes/tomato-salad');
    expect(JSON.parse(String(seen!.init.body)).title).toBe('Tomato salad');
  });

  it('omits servings entirely when none was asked for', async () => {
    let body: Record<string, unknown> = {};
    const service = setup(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse(recipePayload);
    });

    await service.recipe(recipeInput);

    expect('servings' in body).toBe(false);
  });

  it('sends the servings when one was asked for', async () => {
    let body: Record<string, unknown> = {};
    const service = setup(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse(recipePayload);
    });

    await service.recipe({ ...recipeInput, servings: 4 });

    expect(body.servings).toBe(4);
  });

  it('returns the recipe and what the pantry cannot cover', async () => {
    const service = setup(async () => jsonResponse(recipePayload));

    const result = await service.recipe(recipeInput);

    expect(result.recipe.title).toBe('Tomato salad');
    expect(result.missingIngredients).toEqual(['basil']);
  });

  it('raises a distinct error when the recipe was withheld over a dietary rule', async () => {
    const service = setup(async () =>
      jsonResponse({ error: 'recipe_violates_preferences', ingredients: ['peanut oil'] }, 422),
    );

    await expect(service.recipe(recipeInput)).rejects.toThrow(RecipeRejectedError);
  });

  it('carries which ingredients caused the rejection, so the user is told why', async () => {
    const service = setup(async () =>
      jsonResponse({ error: 'recipe_violates_preferences', ingredients: ['peanut oil'] }, 422),
    );

    await expect(service.recipe(recipeInput)).rejects.toMatchObject({
      ingredients: ['peanut oil'],
    });
  });

  it('raises a service error when the body is not a recipe', async () => {
    const service = setup(async () => jsonResponse({ recipe: { title: 'x' } }));

    await expect(service.recipe(recipeInput)).rejects.toThrow(SuggestionServiceError);
  });
});

describe('http recipe suggestion service - meal plan settings', () => {
  const planInput = {
    pantry,
    preferences: DEFAULT_PREFERENCES,
    slots: [{ date: '2026-09-21', slot: 'dinner' as const }],
    exclude: [],
  };

  async function sentBody(extra: Record<string, unknown>) {
    let body: Record<string, unknown> = {};
    const service = setup((async (_url: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse({ entries: [], unfilled: [] });
    }) as typeof fetch);

    await service.planWeek({ ...planInput, ...extra });
    return body;
  }

  it('sends the region, repeat and ingredient settings', async () => {
    const body = await sentBody({ region: 'CO', allowRepeats: true, includeIngredients: true });

    expect(body).toMatchObject({ region: 'CO', allowRepeats: true, includeIngredients: true });
  });

  it('defaults to Colombia, no repeats and no ingredients', async () => {
    const body = await sentBody({});

    expect(body).toMatchObject({ region: 'CO', allowRepeats: false, includeIngredients: false });
  });

  it('hands back the ingredients the server included', async () => {
    const recipeIngredients = [
      { name: 'tomato', quantity: { amount: 2, unit: 'unit' }, optional: false },
    ];
    const service = setup((async () =>
      jsonResponse({
        entries: [
          {
            date: '2026-09-21',
            slot: 'dinner',
            dishId: 'pasta',
            dishTitle: 'Pasta',
            summary: '',
            ingredients: ['tomato'],
            recipeIngredients,
          },
        ],
        unfilled: [],
      })) as typeof fetch);

    const result = await service.planWeek({ ...planInput, includeIngredients: true });

    expect(result.entries[0].recipeIngredients).toEqual(recipeIngredients);
  });
});
