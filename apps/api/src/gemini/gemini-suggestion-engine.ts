import type { PreferencesDto, RawDishSuggestion, RecipeDto } from '@recetapp/contracts';

import type { SuggestionEngine } from '../app.ts';

import { GEMINI_RECIPE_SCHEMA, parseModelRecipe } from './recipe-schema.ts';
import { GEMINI_RESPONSE_SCHEMA, parseModelSuggestions } from './suggestion-schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 20_000;

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

function buildSuggestionPrompt(pantry: string[], preferences: PreferencesDto): string {
  const rules =
    preferences.suggestionMode === 'strict'
      ? 'Use ONLY ingredients from the pantry list and the staples list. Do not introduce anything else.'
      : `You may introduce at most ${preferences.maxMissingIngredients} ingredients that are not in the pantry.`;

  return [
    'You suggest dishes someone can cook from what they already have at home.',
    '',
    `Pantry: ${JSON.stringify(pantry)}`,
    `Staples always available: ${JSON.stringify(preferences.staples)}`,
    `Dietary requirements: ${JSON.stringify(preferences.dietary)}`,
    `Never use these ingredients: ${JSON.stringify(preferences.dislikes)}`,
    '',
    rules,
    'Propose at most 8 dishes. List every ingredient each dish needs, marking as optional only what can genuinely be left out.',
    'Answer with JSON matching the required schema and nothing else.',
  ].join('\n');
}

function buildRecipePrompt(title: string, pantry: string[], preferences: PreferencesDto): string {
  return [
    `Write the full recipe for the dish titled ${JSON.stringify(title)}.`,
    '',
    `The cook has: ${JSON.stringify(pantry)}`,
    `Staples always available: ${JSON.stringify(preferences.staples)}`,
    `Dietary requirements: ${JSON.stringify(preferences.dietary)}`,
    `Never use these ingredients: ${JSON.stringify(preferences.dislikes)}`,
    '',
    'Give every ingredient a numeric amount and one of the allowed units.',
    'Write the steps in the order they are performed, one action per step.',
    'Answer with JSON matching the required schema and nothing else.',
  ].join('\n');
}

function buildWeekPrompt(pantry: string[], preferences: PreferencesDto, count: number): string {
  const rules =
    preferences.suggestionMode === 'strict'
      ? 'Use ONLY ingredients from the pantry list and the staples list.'
      : `You may introduce at most ${preferences.maxMissingIngredients} ingredients per dish that are not in the pantry.`;

  return [
    'You plan a week of meals for someone, using what they have at home.',
    '',
    `Pantry: ${JSON.stringify(pantry)}`,
    `Staples always available: ${JSON.stringify(preferences.staples)}`,
    `Dietary requirements: ${JSON.stringify(preferences.dietary)}`,
    `Never use these ingredients: ${JSON.stringify(preferences.dislikes)}`,
    '',
    rules,
    // More than the week needs, because the mode filter and the no-repeat
    // rule both discard dishes before anything reaches a slot.
    `Propose ${Math.min(12, count + 4)} DIFFERENT dishes. Vary the main ingredient and the cooking method; do not propose the same dish twice under different names.`,
    'List every ingredient each dish needs, marking as optional only what can genuinely be left out.',
    'Answer with JSON matching the required schema and nothing else.',
  ].join('\n');
}

/**
 * Gemini adapter for the engine port.
 *
 * Talks to the REST API directly rather than through an SDK: this service
 * exists to make these calls, and the REST contract is stable, which keeps a
 * dependency and its version drift out of the build.
 *
 * The key travels in a header, never in the URL, so it cannot end up in access
 * logs, proxies or error messages that quote the request line.
 */
export function createGeminiSuggestionEngine(options: GeminiOptions): SuggestionEngine {
  const doFetch = options.fetchImpl ?? fetch;

  async function askForJson(prompt: string, responseSchema: unknown): Promise<unknown> {
    const response = await doFetch(
      `${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      // Status only. The body can quote the request, and the request carries
      // the prompt.
      throw new Error(`Gemini responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no content');

    // Structured output is requested, not guaranteed: the model can still
    // return prose, or JSON with a shape of its own invention.
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Gemini returned content that is not JSON');
    }
  }

  return {
    async suggest({ pantry, preferences }): Promise<RawDishSuggestion[]> {
      const parsed = await askForJson(
        buildSuggestionPrompt(pantry, preferences),
        GEMINI_RESPONSE_SCHEMA,
      );
      return parseModelSuggestions(parsed);
    },

    async recipe({ title, pantry, preferences }): Promise<RecipeDto> {
      const parsed = await askForJson(
        buildRecipePrompt(title, pantry, preferences),
        GEMINI_RECIPE_SCHEMA,
      );
      return parseModelRecipe(parsed);
    },

    async planWeek({ pantry, preferences, count }): Promise<RawDishSuggestion[]> {
      const parsed = await askForJson(
        buildWeekPrompt(pantry, preferences, count),
        GEMINI_RESPONSE_SCHEMA,
      );
      return parseModelSuggestions(parsed);
    },
  };
}
