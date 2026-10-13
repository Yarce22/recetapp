import type { PreferencesDto, RawDishSuggestion, SuggestionsResponse } from '@recetapp/contracts';

import { MalformedModelResponseError } from '../../gemini/suggestion-schema.ts';
import { createRateLimiter } from '../../policy/rate-limit.ts';
import { createApp } from '../../app.ts';
import type { SuggestionEngine } from '../../app.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['salt'],
  dietary: [],
  dislikes: [],
};

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    pantry: [{ name: 'Tomato', quantity: { amount: 3, unit: 'unit' } }],
    preferences,
    ...overrides,
  });

const NOT_USED_HERE = {
  recipe: async () => {
    throw new Error('the recipe endpoint has its own test');
  },
};

function setup(
  engine: Partial<SuggestionEngine>,
  limits = { perDevicePerHour: 10, globalPerHour: 100 },
) {
  return createApp({
    engine: { ...NOT_USED_HERE, ...engine } as SuggestionEngine,
    limiter: createRateLimiter({ ...limits, now: () => 0 }),
  });
}

const engineReturning = (suggestions: RawDishSuggestion[]): Partial<SuggestionEngine> => ({
  suggest: async () => suggestions,
});

const post = (app: ReturnType<typeof createApp>, init: RequestInit = {}) =>
  app.request('/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': 'device-a' },
    body: body(),
    ...init,
  });

describe('POST /suggestions', () => {
  it('returns the suggestions that survive the mode filter', async () => {
    const app = setup(
      engineReturning([
        { title: 'Tomato salad', summary: 'x', ingredients: [{ name: 'tomato', optional: false }] },
        { title: 'Paella', summary: 'x', ingredients: [{ name: 'saffron', optional: false }] },
      ]),
    );

    const response = await post(app);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as SuggestionsResponse;
    expect(payload.suggestions.map((s) => s.title)).toEqual(['Tomato salad']);
    expect(payload.filteredOut).toBe(1);
  });

  it('rejects a request without a device identifier', async () => {
    const app = setup(engineReturning([]));

    const response = await post(app, {
      headers: { 'content-type': 'application/json' },
      body: body(),
    });

    expect(response.status).toBe(400);
  });

  it('rejects a malformed request body', async () => {
    const app = setup(engineReturning([]));

    const response = await post(app, { body: JSON.stringify({ pantry: 'everything' }) });
    expect(response.status).toBe(400);
  });

  it('answers 429 once the device runs out of allowance', async () => {
    const app = setup(engineReturning([]), { perDevicePerHour: 1, globalPerHour: 100 });

    expect((await post(app)).status).toBe(200);

    const blocked = await post(app);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('answers 502 when the model returns something unusable', async () => {
    const app = setup({
      suggest: async () => {
        throw new MalformedModelResponseError('not json');
      },
    });

    const response = await post(app);
    expect(response.status).toBe(502);
  });

  it('never echoes internal failure details to the client', async () => {
    const app = setup({
      suggest: async () => {
        throw new Error('gemini request failed: key AIzaSyFAKE123 rejected');
      },
    });

    const response = await post(app);
    expect(response.status).toBe(502);

    const text = await response.text();
    expect(text).not.toContain('AIzaSyFAKE123');
    expect(text).not.toContain('gemini');
  });

  it('passes the pantry names and preferences through to the engine', async () => {
    const seen: unknown[] = [];
    const app = setup({
      suggest: async (input) => {
        seen.push(input);
        return [];
      },
    });

    await post(app);

    expect(seen).toEqual([{ pantry: ['Tomato'], preferences, language: 'en' }]);
  });

  it('tells the engine which language to answer in', async () => {
    const seen: unknown[] = [];
    const app = setup({
      suggest: async (input) => {
        seen.push(input);
        return [];
      },
    });

    const response = await post(app, { body: body({ language: 'es' }) });

    expect(response.status).toBe(200);
    expect(seen).toEqual([{ pantry: ['Tomato'], preferences, language: 'es' }]);
  });

  it('rejects a language the app does not support', async () => {
    const app = setup(engineReturning([]));

    const response = await post(app, { body: body({ language: 'fr' }) });

    expect(response.status).toBe(400);
  });
});
