import type { DishSuggestionDto, PreferencesDto, SuggestionsResponse } from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';

import {
  RateLimitedError,
  SuggestionServiceError,
  type RecipeSuggestionService,
  type SuggestionResult,
} from '../domain/recipe-suggestion-service';

export type HttpSuggestionServiceOptions = {
  baseUrl: string;
  /** Anonymous, stable per install. What the backend counts requests against. */
  deviceId: string;
  fetchImpl?: typeof fetch;
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
            preferences,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new SuggestionServiceError('Could not reach RecetApp. Check your connection.');
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new RateLimitedError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      }

      if (!response.ok) {
        throw new SuggestionServiceError('RecetApp could not come up with dishes right now.');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new SuggestionServiceError('The response could not be read.');
      }

      const candidate = payload as Partial<SuggestionsResponse>;
      if (!Array.isArray(candidate.suggestions) || !candidate.suggestions.every(looksLikeSuggestion)) {
        throw new SuggestionServiceError('The response was not in the expected shape.');
      }

      return {
        suggestions: candidate.suggestions,
        filteredOut: typeof candidate.filteredOut === 'number' ? candidate.filteredOut : 0,
      };
    },
  };
}
