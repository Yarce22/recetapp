import type {
  Language,
  PreferencesDto,
  RawDishSuggestion,
  Region,
  RecipeDto,
} from '@recetapp/contracts';

import type { SuggestionEngine } from '../app.ts';

import { GEMINI_RECIPE_SCHEMA, parseModelRecipe } from './recipe-schema.ts';
import { REGION_PROFILES } from './region-profiles.ts';
import {
  GEMINI_PLAN_WITH_INGREDIENTS_SCHEMA,
  GEMINI_RESPONSE_SCHEMA,
  MAX_PLAN_SUGGESTIONS,
  parseModelSuggestions,
} from './suggestion-schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 20_000;
/** A plan can ask for dozens of dishes in one answer, which takes longer. */
const PLAN_TIMEOUT_MS = 60_000;

/**
 * Pauses before each retry, so its length is also the retry budget. Short on
 * purpose: the app gives up on a request after 30s, and a user is waiting.
 */
const DEFAULT_RETRY_DELAYS_MS = [600, 1800];

/**
 * Statuses that mean "Gemini is busy", not "this request is wrong". A 429 is
 * left out: it is a quota, and hammering it only spends more of it.
 */
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Pauses between retries of a transient failure. Tests pass zeros. */
  retryDelaysMs?: number[];
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Spanish' };

/**
 * Tells the model which language the people-facing text must be in.
 *
 * Only prose is localized. The response schemas are identical for every
 * language, so the enum values the app branches on (units, difficulty) must
 * stay in English: they are identifiers, not text.
 */
function languageInstructions(language: Language): string[] {
  const lines = [
    `Write every title, summary, ingredient name and step in ${LANGUAGE_NAMES[language]}.`,
    'Keep the JSON keys and the unit and difficulty values in English, exactly as the schema allows.',
  ];

  if (language !== 'en') {
    // The pantry and the staples are matched against ingredient names by text,
    // so a name the model rewords is a name the app cannot recognise.
    lines.push(
      'When an ingredient is in the pantry or the staples list, use its name exactly as written there.',
    );
  }

  return lines;
}

function buildSuggestionPrompt(
  pantry: string[],
  preferences: PreferencesDto,
  language: Language,
): string {
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
    ...languageInstructions(language),
    'Answer with JSON matching the required schema and nothing else.',
  ].join('\n');
}

function buildRecipePrompt(
  title: string,
  pantry: string[],
  preferences: PreferencesDto,
  language: Language,
): string {
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
    ...languageInstructions(language),
    'Answer with JSON matching the required schema and nothing else.',
  ].join('\n');
}

export type WeekPromptInput = {
  pantry: string[];
  preferences: PreferencesDto;
  count: number;
  language: Language;
  region: Region;
  allowRepeats: boolean;
  includeIngredients: boolean;
};

function buildWeekPrompt(input: WeekPromptInput): string {
  const { pantry, preferences, count, language, region, allowRepeats, includeIngredients } = input;
  const profile = REGION_PROFILES[region];
  const rules =
    preferences.suggestionMode === 'strict'
      ? 'Use ONLY ingredients from the pantry list and the staples list.'
      : `You may introduce at most ${preferences.maxMissingIngredients} ingredients per dish that are not in the pantry.`;

  // More than the plan needs when repeats are banned, because the mode filter
  // and the no-repeat rule both discard dishes before anything reaches a slot.
  const dishes = allowRepeats
    ? Math.min(MAX_PLAN_SUGGESTIONS, Math.max(7, Math.ceil(count / 2)))
    : Math.min(MAX_PLAN_SUGGESTIONS, count + 4);

  const variety = allowRepeats
    ? `Propose ${dishes} dishes. Dishes may repeat across the plan, so favour the best matches, but still vary the main ingredient and the cooking method.`
    : `Propose ${dishes} DIFFERENT dishes. Never repeat a dish, not even under a different name. Vary the main ingredient and the cooking method.`;

  return [
    `You plan meals for someone living in ${profile.name}, using what they have at home.`,
    '',
    `Pantry: ${JSON.stringify(pantry)}`,
    `Staples always available: ${JSON.stringify(preferences.staples)}`,
    `Dietary requirements: ${JSON.stringify(preferences.dietary)}`,
    `Never use these ingredients: ${JSON.stringify(preferences.dislikes)}`,
    '',
    rules,
    variety,
    ...profile.guidance,
    'List every ingredient each dish needs, marking as optional only what can genuinely be left out.',
    ...(includeIngredients
      ? [
          'Give every ingredient a numeric amount for one serving of the dish and one of the allowed units.',
        ]
      : []),
    ...languageInstructions(language),
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
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  async function send(prompt: string, responseSchema: unknown, timeoutMs: number) {
    return doFetch(`${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`, {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function askForJson(
    prompt: string,
    responseSchema: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    let response = await send(prompt, responseSchema, timeoutMs);

    // Each attempt gets its own timeout, so a stuck call is bounded but a busy
    // model gets a few seconds to recover before the user sees an error.
    for (const delay of retryDelaysMs) {
      if (response.ok || !TRANSIENT_STATUSES.has(response.status)) break;
      await sleep(delay);
      response = await send(prompt, responseSchema, timeoutMs);
    }

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
    async suggest({ pantry, preferences, language }): Promise<RawDishSuggestion[]> {
      const parsed = await askForJson(
        buildSuggestionPrompt(pantry, preferences, language),
        GEMINI_RESPONSE_SCHEMA,
      );
      return parseModelSuggestions(parsed);
    },

    async recipe({ title, pantry, preferences, language }): Promise<RecipeDto> {
      const parsed = await askForJson(
        buildRecipePrompt(title, pantry, preferences, language),
        GEMINI_RECIPE_SCHEMA,
      );
      return parseModelRecipe(parsed);
    },

    async planWeek(input): Promise<RawDishSuggestion[]> {
      const parsed = await askForJson(
        buildWeekPrompt(input),
        input.includeIngredients ? GEMINI_PLAN_WITH_INGREDIENTS_SCHEMA : GEMINI_RESPONSE_SCHEMA,
        PLAN_TIMEOUT_MS,
      );
      return parseModelSuggestions(parsed, { max: MAX_PLAN_SUGGESTIONS });
    },
  };
}
