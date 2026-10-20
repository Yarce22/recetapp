import type { MealPlanResponse, PreferencesDto, RawDishSuggestion } from '@recetapp/contracts';

import { createApp } from '../../app.ts';
import type { SuggestionEngine } from '../../app.ts';
import { MalformedModelResponseError } from '../../gemini/suggestion-schema.ts';
import { createRateLimiter } from '../../policy/rate-limit.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'flexible',
  maxMissingIngredients: 3,
  staples: ['salt'],
  dietary: [],
  dislikes: [],
};

const dish = (title: string): RawDishSuggestion => ({
  title,
  summary: `A dish called ${title}`,
  ingredients: [{ name: 'tomato', optional: false }],
});

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    pantry: [{ name: 'Tomato', quantity: { amount: 500, unit: 'g' } }],
    preferences,
    slots: [
      { date: '2026-09-21', slot: 'dinner' },
      { date: '2026-09-22', slot: 'dinner' },
    ],
    exclude: [],
    ...overrides,
  });

function setup(engine: Partial<SuggestionEngine>, limits = { perDevicePerHour: 10 }) {
  return createApp({
    engine: {
      suggest: async () => [],
      recipe: async () => {
        throw new Error('not used here');
      },
      planWeek: async () => [],
      ...engine,
    } as SuggestionEngine,
    limiter: createRateLimiter({ ...limits, globalPerHour: 100, now: () => 0 }),
  });
}

const post = (app: ReturnType<typeof createApp>, init: RequestInit = {}) =>
  app.request('/meal-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': 'device-a' },
    body: body(),
    ...init,
  });

describe('POST /meal-plan', () => {
  it('fills the requested slots with different dishes', async () => {
    const app = setup({ planWeek: async () => [dish('Pasta'), dish('Stew')] });

    const response = await post(app);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as MealPlanResponse;
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries.map((e) => e.dishTitle)).toEqual(['Pasta', 'Stew']);
    expect(payload.unfilled).toEqual([]);
  });

  it('reports the slots it could not fill rather than repeating a dish', async () => {
    const app = setup({ planWeek: async () => [dish('Pasta')] });

    const payload = (await (await post(app)).json()) as MealPlanResponse;
    expect(payload.entries).toHaveLength(1);
    expect(payload.unfilled).toEqual([{ date: '2026-09-22', slot: 'dinner' }]);
  });

  it('skips dishes the caller says are already in the week', async () => {
    const app = setup({ planWeek: async () => [dish('Pasta'), dish('Stew')] });

    const response = await post(app, {
      body: body({
        slots: [{ date: '2026-09-21', slot: 'dinner' }],
        exclude: ['Pasta'],
      }),
    });

    const payload = (await response.json()) as MealPlanResponse;
    expect(payload.entries[0].dishTitle).toBe('Stew');
  });

  it('plans the week without handing the engine the pantry', async () => {
    let received: Record<string, unknown> = {};
    const app = setup({
      planWeek: async (input) => {
        received = input as unknown as Record<string, unknown>;
        return [];
      },
    });

    await post(app);

    expect(received).not.toHaveProperty('pantry');
  });

  it('fills the week with dishes the pantry cannot cook, even in strict mode', async () => {
    const strict = { ...preferences, suggestionMode: 'strict', maxMissingIngredients: 0 };
    const app = setup({
      planWeek: async () => [
        {
          title: 'Paella',
          summary: 'Rice and saffron.',
          ingredients: [{ name: 'saffron', optional: false }],
        },
        { title: 'Curry', summary: 'Spiced.', ingredients: [{ name: 'curry', optional: false }] },
      ],
    });

    const response = await post(app, { body: body({ preferences: strict }) });

    const payload = (await response.json()) as MealPlanResponse;
    expect(payload.entries.map((e) => e.dishTitle)).toEqual(['Paella', 'Curry']);
    expect(payload.unfilled).toEqual([]);
  });

  it('tells the engine how many dishes the week needs', async () => {
    let asked = 0;
    const app = setup({
      planWeek: async (input) => {
        asked = input.count;
        return [];
      },
    });

    await post(app, {
      body: body({
        slots: [
          { date: '2026-09-21', slot: 'lunch' },
          { date: '2026-09-21', slot: 'dinner' },
          { date: '2026-09-22', slot: 'dinner' },
        ],
      }),
    });

    expect(asked).toBe(3);
  });

  it('rejects a date that is not a calendar date', async () => {
    const app = setup({});

    const response = await post(app, {
      body: body({ slots: [{ date: '21/09/2026', slot: 'dinner' }] }),
    });

    expect(response.status).toBe(400);
  });

  it('rejects a slot name it does not know', async () => {
    const app = setup({});

    const response = await post(app, {
      body: body({ slots: [{ date: '2026-09-21', slot: 'brunch' }] }),
    });

    expect(response.status).toBe(400);
  });

  it('rejects an empty slot list, since there is nothing to plan', async () => {
    const app = setup({});

    expect((await post(app, { body: body({ slots: [] }) })).status).toBe(400);
  });

  it('rejects more slots than two weeks can hold', async () => {
    const app = setup({});
    const slots = Array.from({ length: 43 }, () => ({ date: '2026-09-21', slot: 'dinner' }));

    expect((await post(app, { body: body({ slots }) })).status).toBe(400);
  });

  it('accepts a two week plan', async () => {
    const app = setup({});
    const slots = Array.from({ length: 42 }, () => ({ date: '2026-09-21', slot: 'dinner' }));

    expect((await post(app, { body: body({ slots }) })).status).toBe(200);
  });

  it('hands the engine the region, defaulting to Colombia', async () => {
    const seen: unknown[] = [];
    const app = setup({
      planWeek: async (input) => {
        seen.push(input.region);
        return [];
      },
    });

    await post(app);
    await post(app, { body: body({ region: 'CO' }) });

    expect(seen).toEqual(['CO', 'CO']);
  });

  it('rejects a region it does not know', async () => {
    const app = setup({});

    expect((await post(app, { body: body({ region: 'ZZ' }) })).status).toBe(400);
  });

  it('does not repeat dishes unless asked to', async () => {
    const app = setup({ planWeek: async () => [dish('Pasta')] });

    const payload = (await (await post(app)).json()) as MealPlanResponse;
    expect(payload.entries).toHaveLength(1);

    const repeated = (await (
      await post(app, { body: body({ allowRepeats: true }) })
    ).json()) as MealPlanResponse;
    expect(repeated.entries.map((e) => e.dishTitle)).toEqual(['Pasta', 'Pasta']);
    expect(repeated.unfilled).toEqual([]);
  });

  it('tells the engine whether repeats and ingredients are wanted', async () => {
    const seen: { allowRepeats: boolean; includeIngredients: boolean }[] = [];
    const app = setup({
      planWeek: async (input) => {
        seen.push({
          allowRepeats: input.allowRepeats,
          includeIngredients: input.includeIngredients,
        });
        return [];
      },
    });

    await post(app);
    await post(app, { body: body({ allowRepeats: true, includeIngredients: true }) });

    expect(seen).toEqual([
      { allowRepeats: false, includeIngredients: false },
      { allowRepeats: true, includeIngredients: true },
    ]);
  });

  it('returns each dish ingredients when asked to include them', async () => {
    const withAmounts: RawDishSuggestion = {
      title: 'Pasta',
      summary: 's',
      ingredients: [{ name: 'tomato', optional: false, quantity: { amount: 300, unit: 'g' } }],
    };
    const app = setup({ planWeek: async () => [withAmounts] });

    const payload = (await (
      await post(app, {
        body: body({
          includeIngredients: true,
          slots: [{ date: '2026-09-21', slot: 'dinner' }],
        }),
      })
    ).json()) as MealPlanResponse;

    expect(payload.entries[0].recipeIngredients).toEqual([
      { name: 'tomato', quantity: { amount: 300, unit: 'g' }, optional: false },
    ]);
  });

  it('requires a device identifier like every other route', async () => {
    const app = setup({});

    const response = await post(app, { headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(400);
  });

  it('answers 429 once the device runs out of allowance', async () => {
    const app = setup({ planWeek: async () => [dish('Pasta')] }, { perDevicePerHour: 1 });

    expect((await post(app)).status).toBe(200);
    expect((await post(app)).status).toBe(429);
  });

  it('answers 502 when the model returns something unusable', async () => {
    const app = setup({
      planWeek: async () => {
        throw new MalformedModelResponseError('nope');
      },
    });

    expect((await post(app)).status).toBe(502);
  });
});
