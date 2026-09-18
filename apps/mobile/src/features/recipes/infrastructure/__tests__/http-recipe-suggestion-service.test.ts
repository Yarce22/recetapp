import {
  RateLimitedError,
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
