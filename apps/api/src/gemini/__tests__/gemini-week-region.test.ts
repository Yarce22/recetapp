import type { PreferencesDto } from '@recetapp/contracts';

import { createGeminiSuggestionEngine } from '../gemini-suggestion-engine.ts';
import { REGION_PROFILES } from '../region-profiles.ts';

const preferences: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 0,
  staples: ['salt'],
  dietary: ['vegetarian'],
  dislikes: ['peanut'],
};

const dishes = {
  suggestions: [
    {
      title: 'Ensalada',
      summary: 'Fresca.',
      ingredients: [{ name: 'tomate', optional: false }],
    },
  ],
};

async function weekPrompt() {
  let prompt = '';
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const sent = JSON.parse(String(init?.body)) as { contents: { parts: { text: string }[] }[] };
    prompt = sent.contents[0].parts[0].text;
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(dishes) }] } }] }),
      { status: 200 },
    );
  }) as typeof fetch;

  const engine = createGeminiSuggestionEngine({ apiKey: 'test', model: 'test-model', fetchImpl });
  await engine.planWeek({
    preferences,
    count: 3,
    language: 'es',
    region: 'CO',
    allowRepeats: false,
    includeIngredients: false,
  });
  return prompt;
}

describe('Gemini week prompt', () => {
  it('does not mention the pantry, whatever the suggestion mode', async () => {
    expect(await weekPrompt()).not.toMatch(/pantry/i);
  });

  it('limits the dishes to what is sold in the chosen region', async () => {
    const prompt = await weekPrompt();

    expect(prompt).toContain(REGION_PROFILES.CO.name);
    expect(prompt).toMatch(/readily available|easy to find/i);
  });

  it('still carries the dietary rules and the dislikes', async () => {
    const prompt = await weekPrompt();

    expect(prompt).toContain('vegetarian');
    expect(prompt).toContain('peanut');
  });
});
