import type { PreferencesDto } from '@recetapp/contracts';

import { createGeminiSuggestionEngine } from '../gemini-suggestion-engine.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: [],
  dietary: [],
  dislikes: [],
};

const recipe = {
  title: 'Ensalada',
  servings: 2,
  timeMinutes: 10,
  difficulty: 'easy',
  ingredients: [{ name: 'tomate', amount: 2, unit: 'unit', optional: false }],
  steps: ['Cortar.'],
};

const okResponse = () =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(recipe) }] } }] }),
    { status: 200 },
  );

/** A fake Gemini that answers each call from `statuses` in order, then 200. */
function setup(statuses: number[], retryDelaysMs = [0, 0]) {
  let calls = 0;

  const fetchImpl = (async () => {
    const status = statuses[calls] ?? 200;
    calls += 1;
    return status === 200 ? okResponse() : new Response('overloaded', { status });
  }) as typeof fetch;

  const engine = createGeminiSuggestionEngine({
    apiKey: 'test',
    model: 'test-model',
    fetchImpl,
    retryDelaysMs,
  });

  return { engine, calls: () => calls };
}

const ask = (engine: ReturnType<typeof setup>['engine']) =>
  engine.recipe({ title: 'Ensalada', pantry: ['tomate'], preferences, language: 'es' });

describe('Gemini engine retries', () => {
  it('recovers when a transient 503 is followed by a good answer', async () => {
    const { engine, calls } = setup([503]);

    await expect(ask(engine)).resolves.toMatchObject({ title: 'Ensalada' });
    expect(calls()).toBe(2);
  });

  it('keeps trying through consecutive overloads up to the configured delays', async () => {
    const { engine, calls } = setup([503, 503]);

    await expect(ask(engine)).resolves.toMatchObject({ title: 'Ensalada' });
    expect(calls()).toBe(3);
  });

  it('gives up with the last status once the retries are spent', async () => {
    const { engine, calls } = setup([503, 503, 503, 503]);

    await expect(ask(engine)).rejects.toThrow('Gemini responded with 503');
    expect(calls()).toBe(3);
  });

  it('retries other transient server statuses', async () => {
    const { engine, calls } = setup([500, 504]);

    await expect(ask(engine)).resolves.toMatchObject({ title: 'Ensalada' });
    expect(calls()).toBe(3);
  });

  it.each([400, 401, 403, 404, 429])('does not retry a %i, which a retry cannot fix', async (status) => {
    const { engine, calls } = setup([status, status, status]);

    await expect(ask(engine)).rejects.toThrow(`Gemini responded with ${status}`);
    expect(calls()).toBe(1);
  });
});
