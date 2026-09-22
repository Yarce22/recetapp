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

  it('rejects more slots than a week can hold', async () => {
    const app = setup({});
    const slots = Array.from({ length: 30 }, () => ({ date: '2026-09-21', slot: 'dinner' }));

    expect((await post(app, { body: body({ slots }) })).status).toBe(400);
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
