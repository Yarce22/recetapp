import type { PreferencesDto, RecipeDto } from '@recetapp/contracts';

import { createApp } from '../../app.ts';
import type { SuggestionEngine } from '../../app.ts';
import { createRateLimiter } from '../../policy/rate-limit.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'flexible',
  maxMissingIngredients: 3,
  staples: ['salt'],
  dietary: [],
  dislikes: [],
};

const recipe: RecipeDto = {
  id: 'tomato-salad',
  title: 'Tomato salad',
  servings: 2,
  ingredients: [{ name: 'tomato', quantity: { amount: 400, unit: 'g' }, optional: false }],
  steps: ['Chop.'],
  timeMinutes: 10,
  difficulty: 'easy',
};

type Seen = { language?: string };

/** An app whose engine records the language each call was made with. */
function setup() {
  const seen: Record<'suggest' | 'recipe' | 'planWeek', Seen[]> = {
    suggest: [],
    recipe: [],
    planWeek: [],
  };

  const engine: SuggestionEngine = {
    suggest: async (input) => {
      seen.suggest.push(input);
      return [];
    },
    recipe: async (input) => {
      seen.recipe.push(input);
      return recipe;
    },
    planWeek: async (input) => {
      seen.planWeek.push(input);
      return [];
    },
  };

  const app = createApp({
    engine,
    limiter: createRateLimiter({ perDevicePerHour: 50, globalPerHour: 500, now: () => 0 }),
  });

  return { app, seen };
}

const base = {
  pantry: [{ name: 'Tomato', quantity: { amount: 500, unit: 'g' } }],
  preferences,
};

const ENDPOINTS = {
  suggest: { path: '/suggestions', body: base },
  recipe: { path: '/recipes/tomato-salad', body: { ...base, title: 'Tomato salad' } },
  planWeek: {
    path: '/meal-plan',
    body: { ...base, slots: [{ date: '2026-09-21', slot: 'dinner' }], exclude: [] },
  },
} as const;

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': 'device-a' },
    body: JSON.stringify(body),
  });

describe.each(Object.entries(ENDPOINTS))('language on %s', (name, { path, body }) => {
  const key = name as keyof typeof ENDPOINTS;

  it('defaults to English when the client does not send one', async () => {
    const { app, seen } = setup();

    const response = await post(app, path, body);

    expect(response.status).toBe(200);
    expect(seen[key][0].language).toBe('en');
  });

  it('forwards the requested language to the engine', async () => {
    const { app, seen } = setup();

    const response = await post(app, path, { ...body, language: 'es' });

    expect(response.status).toBe(200);
    expect(seen[key][0].language).toBe('es');
  });

  it('rejects a language the app does not support', async () => {
    const { app, seen } = setup();

    const response = await post(app, path, { ...body, language: 'fr' });

    expect(response.status).toBe(400);
    expect(seen[key]).toHaveLength(0);
  });
});
