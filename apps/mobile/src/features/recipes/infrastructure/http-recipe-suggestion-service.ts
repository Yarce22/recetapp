import {
  DEFAULT_LANGUAGE,
  type DishSuggestionDto,
  type Language,
  type MealPlanResponse,
  type PreferencesDto,
  type RecipeResponse,
  type SuggestionsResponse,
} from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { withLocalizedStaples } from '@/shared/i18n/staples';

import {
  RateLimitedError,
  RecipeRejectedError,
  SuggestionServiceError,
  type MealPlanRequestInput,
  type MealPlanResult,
  type RecipeRequestInput,
  type RecipeResult,
  type RecipeSuggestionService,
  type SuggestionResult,
} from '../domain/recipe-suggestion-service';

export type HttpSuggestionServiceOptions = {
  baseUrl: string;
  /** Anonymous, stable per install. What the backend counts requests against. */
  deviceId: string;
  fetchImpl?: typeof fetch;
  /** Language of the text the server writes. Defaults to English. */
  language?: Language;
};

const REQUEST_TIMEOUT_MS = 30_000;

function looksLikeSuggestion(value: unknown): value is DishSuggestionDto {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<DishSuggestionDto>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.coverage === 'number' &&
    Array.isArray(candidate.matchedIngredients) &&
    Array.isArray(candidate.missingIngredients)
  );
}

function looksLikeRecipe(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.servings === 'number' &&
    Array.isArray(candidate.ingredients) &&
    Array.isArray(candidate.steps)
  );
}

/**
 * Talks to our BFF, which is the only thing that holds the Gemini key.
 *
 * The response is checked here as well as on the server. Not out of distrust
 * of our own backend, but because an old app can meet a new backend, and a
 * captive-portal or proxy can return something that is JSON without being
 * ours.
 */
export function createHttpRecipeSuggestionService(
  options: HttpSuggestionServiceOptions,
): RecipeSuggestionService {
  const doFetch = options.fetchImpl ?? fetch;
  const language = options.language ?? DEFAULT_LANGUAGE;

  /**
   * Preferences as the server should see them.
   *
   * The staples gain their name in the active language, because the model
   * answers in that language and the server matches ingredients by text.
   */
  const forServer = (preferences: PreferencesDto): PreferencesDto => ({
    ...preferences,
    staples: withLocalizedStaples(preferences.staples, language),
  });

  return {
    async suggest(pantry: PantryEntry[], preferences: PreferencesDto): Promise<SuggestionResult> {
      let response: Response;

      try {
        response = await doFetch(`${options.baseUrl}/suggestions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-device-id': options.deviceId,
          },
          body: JSON.stringify({
            pantry: pantry.map((entry) => ({
              name: entry.ingredient.displayName,
              quantity: entry.item.quantity,
            })),
            preferences: forServer(preferences),
            language,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new SuggestionServiceError(
          'Could not reach RecetApp. Check your connection.',
          'unreachable',
        );
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new RateLimitedError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      }

      if (!response.ok) {
        throw new SuggestionServiceError(
          'RecetApp could not come up with dishes right now.',
          'suggest-failed',
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new SuggestionServiceError('The response could not be read.', 'unreadable');
      }

      const candidate = payload as Partial<SuggestionsResponse>;
      if (
        !Array.isArray(candidate.suggestions) ||
        !candidate.suggestions.every(looksLikeSuggestion)
      ) {
        throw new SuggestionServiceError(
          'The response was not in the expected shape.',
          'bad-shape',
        );
      }

      return {
        suggestions: candidate.suggestions,
        filteredOut: typeof candidate.filteredOut === 'number' ? candidate.filteredOut : 0,
      };
    },

    async recipe(input: RecipeRequestInput): Promise<RecipeResult> {
      let response: Response;

      try {
        response = await doFetch(`${options.baseUrl}/recipes/${encodeURIComponent(input.id)}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-device-id': options.deviceId,
          },
          body: JSON.stringify({
            title: input.title,
            pantry: input.pantry.map((entry) => ({
              name: entry.ingredient.displayName,
              quantity: entry.item.quantity,
            })),
            preferences: forServer(input.preferences),
            language,
            ...(input.servings === undefined ? {} : { servings: input.servings }),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new SuggestionServiceError(
          'Could not reach RecetApp. Check your connection.',
          'unreachable',
        );
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new RateLimitedError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      }

      // 422 is not a glitch: the server withheld a recipe that broke a dietary
      // rule, and the user is owed that explanation rather than a generic error.
      if (response.status === 422) {
        let ingredients: string[] = [];
        try {
          const detail = (await response.json()) as { ingredients?: unknown };
          if (Array.isArray(detail.ingredients)) {
            ingredients = detail.ingredients.filter(
              (entry): entry is string => typeof entry === 'string',
            );
          }
        } catch {
          // The status already carries the meaning.
        }
        throw new RecipeRejectedError(ingredients);
      }

      if (!response.ok) {
        throw new SuggestionServiceError(
          'RecetApp could not write that recipe right now.',
          'recipe-failed',
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new SuggestionServiceError('The response could not be read.', 'unreadable');
      }

      const candidate = payload as Partial<RecipeResponse>;
      if (!looksLikeRecipe(candidate.recipe)) {
        throw new SuggestionServiceError(
          'The response was not in the expected shape.',
          'bad-shape',
        );
      }

      return {
        recipe: candidate.recipe as RecipeResult['recipe'],
        missingIngredients: Array.isArray(candidate.missingIngredients)
          ? candidate.missingIngredients.filter(
              (entry): entry is string => typeof entry === 'string',
            )
          : [],
      };
    },

    async planWeek(input: MealPlanRequestInput): Promise<MealPlanResult> {
      let response: Response;

      try {
        response = await doFetch(`${options.baseUrl}/meal-plan`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-device-id': options.deviceId,
          },
          body: JSON.stringify({
            pantry: input.pantry.map((entry) => ({
              name: entry.ingredient.displayName,
              quantity: entry.item.quantity,
            })),
            preferences: forServer(input.preferences),
            slots: input.slots,
            exclude: input.exclude,
            language,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new SuggestionServiceError(
          'Could not reach RecetApp. Check your connection.',
          'unreachable',
        );
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new RateLimitedError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      }

      if (!response.ok) {
        throw new SuggestionServiceError(
          'RecetApp could not plan your week right now.',
          'plan-failed',
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new SuggestionServiceError('The response could not be read.', 'unreadable');
      }

      const candidate = payload as Partial<MealPlanResponse>;
      if (!Array.isArray(candidate.entries)) {
        throw new SuggestionServiceError(
          'The response was not in the expected shape.',
          'bad-shape',
        );
      }

      return {
        entries: candidate.entries,
        unfilled: Array.isArray(candidate.unfilled) ? candidate.unfilled : [],
      };
    },
  };
}
