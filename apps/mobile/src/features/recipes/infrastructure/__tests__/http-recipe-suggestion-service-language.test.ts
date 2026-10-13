import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import { SuggestionServiceError } from '@/features/recipes/domain/recipe-suggestion-service';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';

const pantry: PantryEntry[] = [
  {
    ingredient: createIngredient({
      id: 'tomate',
      name: 'Tomate',
      category: 'produce',
      defaultUnit: 'g',
    }),
    item: createPantryItem({
      ingredientId: 'tomate',
      quantity: makeQuantity(500, 'g'),
      lowStockThreshold: null,
    }),
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** A service whose fetch records every request body and answers by URL. */
function setup(language?: 'en' | 'es') {
  const bodies: Record<string, { language?: string; preferences: { staples: string[] } }> = {};

  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.split('/')[1];
    bodies[path] = JSON.parse(String(init?.body));

    if (path === 'suggestions') return json({ suggestions: [], filteredOut: 0 });
    if (path === 'meal-plan') return json({ entries: [], unfilled: [] });
    return json({
      recipe: { title: 'x', servings: 2, ingredients: [], steps: [] },
      missingIngredients: [],
    });
  }) as unknown as typeof fetch;

  const service = createHttpRecipeSuggestionService({
    baseUrl: 'http://localhost:8787',
    deviceId: 'device-a',
    fetchImpl,
    language,
  });

  return { service, bodies };
}

const planInput = {
  pantry,
  preferences: DEFAULT_PREFERENCES,
  slots: [{ date: '2026-09-21', slot: 'dinner' as const }],
  exclude: [],
};

describe('http recipe suggestion service - language', () => {
  it('asks for suggestions in the chosen language', async () => {
    const { service, bodies } = setup('es');

    await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(bodies.suggestions.language).toBe('es');
  });

  it('asks for recipes in the chosen language', async () => {
    const { service, bodies } = setup('es');

    await service.recipe({
      id: 'ensalada',
      title: 'Ensalada',
      pantry,
      preferences: DEFAULT_PREFERENCES,
    });

    expect(bodies.recipes.language).toBe('es');
  });

  it('asks for the week plan in the chosen language', async () => {
    const { service, bodies } = setup('es');

    await service.planWeek(planInput);

    expect(bodies['meal-plan'].language).toBe('es');
  });

  it('sends English when no language was given', async () => {
    const { service, bodies } = setup();

    await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(bodies.suggestions.language).toBe('en');
  });

  it('adds the Spanish staple names so the server can still match them', async () => {
    const { service, bodies } = setup('es');

    await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(bodies.suggestions.preferences.staples).toEqual([
      ...DEFAULT_PREFERENCES.staples,
      'agua',
      'sal',
      'pimienta',
      'aceite',
    ]);
  });

  it('leaves the staples as they are in English', async () => {
    const { service, bodies } = setup('en');

    await service.suggest(pantry, DEFAULT_PREFERENCES);

    expect(bodies.suggestions.preferences.staples).toEqual(DEFAULT_PREFERENCES.staples);
  });
});

describe('http recipe suggestion service - error codes', () => {
  const failing = (fetchImpl: typeof fetch) =>
    createHttpRecipeSuggestionService({
      baseUrl: 'http://localhost:8787',
      deviceId: 'device-a',
      fetchImpl,
    });

  async function codeOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (cause) {
      return (cause as SuggestionServiceError).code;
    }
    return undefined;
  }

  it('tags a network failure as unreachable', async () => {
    const service = failing((async () => {
      throw new Error('offline');
    }) as typeof fetch);

    expect(await codeOf(service.suggest(pantry, DEFAULT_PREFERENCES))).toBe('unreachable');
  });

  it('tags a failure status by what was being asked for', async () => {
    const service = failing((async () => json({}, 500)) as unknown as typeof fetch);

    expect(await codeOf(service.suggest(pantry, DEFAULT_PREFERENCES))).toBe('suggest-failed');
    expect(
      await codeOf(
        service.recipe({ id: 'x', title: 'x', pantry, preferences: DEFAULT_PREFERENCES }),
      ),
    ).toBe('recipe-failed');
    expect(await codeOf(service.planWeek(planInput))).toBe('plan-failed');
  });

  it('tags a body that is not JSON as unreadable', async () => {
    const service = failing((async () => new Response('<html>')) as unknown as typeof fetch);

    expect(await codeOf(service.suggest(pantry, DEFAULT_PREFERENCES))).toBe('unreadable');
  });

  it('tags a JSON body of the wrong shape as bad-shape', async () => {
    const service = failing((async () => json({ nope: true })) as unknown as typeof fetch);

    expect(await codeOf(service.suggest(pantry, DEFAULT_PREFERENCES))).toBe('bad-shape');
  });
});
