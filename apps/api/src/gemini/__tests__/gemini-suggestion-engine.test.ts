import type { PreferencesDto } from '@recetapp/contracts';

import { createGeminiSuggestionEngine } from '../gemini-suggestion-engine.ts';
import { GEMINI_RECIPE_SCHEMA } from '../recipe-schema.ts';
import { GEMINI_RESPONSE_SCHEMA } from '../suggestion-schema.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['salt', 'sal'],
  dietary: [],
  dislikes: [],
};

type SentRequest = { prompt: string; responseSchema: unknown };

/** An engine wired to a fake Gemini that records what it was asked and answers `reply`. */
function setup(reply: unknown) {
  const sent: SentRequest[] = [];

  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      contents: { parts: { text: string }[] }[];
      generationConfig: { responseSchema: unknown };
    };
    sent.push({
      prompt: body.contents[0].parts[0].text,
      responseSchema: body.generationConfig.responseSchema,
    });

    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }),
      { status: 200 },
    );
  }) as typeof fetch;

  const engine = createGeminiSuggestionEngine({ apiKey: 'test', model: 'test-model', fetchImpl });
  return { engine, sent };
}

const dishes = {
  suggestions: [
    {
      title: 'Ensalada',
      summary: 'Fresca.',
      ingredients: [{ name: 'tomate', optional: false }],
    },
  ],
};

const recipe = {
  title: 'Ensalada',
  servings: 2,
  timeMinutes: 10,
  difficulty: 'easy',
  ingredients: [{ name: 'tomate', amount: 2, unit: 'unit', optional: false }],
  steps: ['Cortar.'],
};

describe('Gemini engine language', () => {
  it('asks for Spanish text in the suggestions prompt', async () => {
    const { engine, sent } = setup(dishes);

    await engine.suggest({ pantry: ['tomate'], preferences, language: 'es' });

    expect(sent[0].prompt).toMatch(/Spanish/);
  });

  it('asks for Spanish text in the recipe prompt', async () => {
    const { engine, sent } = setup(recipe);

    await engine.recipe({ title: 'Ensalada', pantry: ['tomate'], preferences, language: 'es' });

    expect(sent[0].prompt).toMatch(/Spanish/);
  });

  it('asks for Spanish text in the week prompt', async () => {
    const { engine, sent } = setup(dishes);

    await engine.planWeek({
      pantry: ['tomate'],
      preferences,
      count: 3,
      language: 'es',
      region: 'CO',
      allowRepeats: false,
      includeIngredients: false,
    });

    expect(sent[0].prompt).toMatch(/Spanish/);
  });

  it('asks for English text when the language is English', async () => {
    const { engine, sent } = setup(dishes);

    await engine.suggest({ pantry: ['tomato'], preferences, language: 'en' });

    expect(sent[0].prompt).toMatch(/English/);
    expect(sent[0].prompt).not.toMatch(/Spanish/);
  });

  it('keeps machine-readable values in English whatever the language', async () => {
    const { engine, sent } = setup(recipe);

    await engine.recipe({ title: 'Ensalada', pantry: [], preferences, language: 'es' });

    expect(sent[0].prompt).toMatch(/unit and difficulty values in English/i);
  });

  it('sends the same response schemas for every language', async () => {
    const spanish = setup(dishes);
    await spanish.engine.suggest({ pantry: [], preferences, language: 'es' });
    const english = setup(dishes);
    await english.engine.suggest({ pantry: [], preferences, language: 'en' });

    expect(spanish.sent[0].responseSchema).toEqual(GEMINI_RESPONSE_SCHEMA);
    expect(english.sent[0].responseSchema).toEqual(GEMINI_RESPONSE_SCHEMA);

    const recipeCall = setup(recipe);
    await recipeCall.engine.recipe({ title: 'x', pantry: [], preferences, language: 'es' });
    expect(recipeCall.sent[0].responseSchema).toEqual(GEMINI_RECIPE_SCHEMA);
  });
});

describe('Gemini engine week prompt settings', () => {
  const run = async (extra: Record<string, unknown> = {}, count = 3) => {
    const { engine, sent } = setup(dishes);
    await engine.planWeek({
      pantry: ['tomate'],
      preferences,
      count,
      language: 'es',
      region: 'CO',
      allowRepeats: false,
      includeIngredients: false,
      ...extra,
    });
    return sent[0];
  };

  it('asks for dishes, ingredients and measures typical of the region', async () => {
    const { prompt } = await run();
    expect(prompt).toContain('Colombia');
    expect(prompt).toMatch(/metric/i);
  });

  it('forbids repeats unless allowed', async () => {
    expect((await run()).prompt).toMatch(/never repeat/i);
    expect((await run({ allowRepeats: true })).prompt).not.toMatch(/never repeat/i);
    expect((await run({ allowRepeats: true })).prompt).toMatch(/may repeat/i);
  });

  it('asks for amounts only when ingredients are included', async () => {
    const without = await run();
    const withAmounts = await run({ includeIngredients: true });

    expect(without.responseSchema).toEqual(GEMINI_RESPONSE_SCHEMA);
    expect(withAmounts.prompt).toMatch(/amount/i);
    expect(JSON.stringify(withAmounts.responseSchema)).toContain('quantity');
    expect(JSON.stringify(without.responseSchema)).not.toContain('quantity');
  });

  it('asks for enough distinct dishes to fill a two week plan', async () => {
    const { prompt } = await run({}, 42);
    expect(prompt).toContain('Propose 46 DIFFERENT dishes');
  });
});
