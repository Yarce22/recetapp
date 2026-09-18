import type { PreferencesDto, RawDishSuggestion } from '@recetapp/contracts';

import type { SuggestionEngine } from '../app.ts';

import { GEMINI_RESPONSE_SCHEMA, parseModelSuggestions } from './suggestion-schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 20_000;

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

function buildPrompt(pantry: string[], preferences: PreferencesDto): string {
  const rules =
    preferences.suggestionMode === 'strict'
      ? 'Use ONLY ingredients from the pantry list and the staples list. Do not introduce anything else.'
      : `You may introduce at most ${preferences.maxMissingIngredients} ingredients that are not in the pantry.`;

  // User-supplied names are passed as JSON data rather than woven into the
  // sentence structure. This does not make prompt injection impossible - the
  // real defences are the response schema and enforceSuggestionMode, which run
  // on whatever comes back - but it keeps ordinary input from reading as
  // instructions.
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

/**
 * Gemini adapter for the suggestion port.
 *
 * Talks to the REST API directly rather than through an SDK: the service is a
 * proxy whose only job is this one call, and the REST contract is stable,
 * which keeps a dependency and its version drift out of the build.
 *
 * The key travels in a header, never in the URL, so it cannot end up in access
 * logs, proxies or error messages that quote the request line.
 */
export function createGeminiSuggestionEngine(options: GeminiOptions): SuggestionEngine {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    async suggest({ pantry, preferences }): Promise<RawDishSuggestion[]> {
      const response = await doFetch(
        `${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': options.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(pantry, preferences) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: GEMINI_RESPONSE_SCHEMA,
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
      if (!text) {
        throw new Error('Gemini returned no content');
      }

      // Structured output is requested, not guaranteed: the model can still
      // return prose, or JSON with a shape of its own invention.
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Gemini returned content that is not JSON');
      }

      return parseModelSuggestions(parsed);
    },
  };
}
