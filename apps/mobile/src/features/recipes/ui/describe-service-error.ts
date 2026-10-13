import type { TranslationKey } from '@/shared/i18n/catalog';
import type { Translate } from '@/shared/i18n/translator';

import {
  RateLimitedError,
  RecipeRejectedError,
  SuggestionServiceError,
  type SuggestionErrorCode,
} from '../domain/recipe-suggestion-service';

const CODE_MESSAGES: Record<SuggestionErrorCode, TranslationKey> = {
  unreachable: 'error.unreachable',
  'suggest-failed': 'error.suggestFailed',
  'recipe-failed': 'error.recipeFailed',
  'plan-failed': 'error.planFailed',
  unreadable: 'error.unreadable',
  'bad-shape': 'error.badShape',
};

/**
 * The sentence to show for a failed request, in the user's language.
 *
 * `fallback` is the screen's own "something went wrong" for failures that are
 * not ours to classify (a bug, an unexpected throw).
 */
export function describeServiceError(
  cause: unknown,
  t: Translate,
  fallback: TranslationKey,
): string {
  if (cause instanceof RateLimitedError) {
    return t('error.rateLimited', { minutes: Math.ceil(cause.retryAfterSeconds / 60) });
  }

  if (cause instanceof RecipeRejectedError) {
    return cause.ingredients.length > 0
      ? t('recipe.error.avoid', { ingredients: cause.ingredients.join(', ') })
      : t('recipe.error.avoidUnnamed');
  }

  if (cause instanceof SuggestionServiceError) {
    return cause.code ? t(CODE_MESSAGES[cause.code]) : cause.message;
  }

  return t(fallback);
}
