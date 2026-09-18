import { normalizeIngredientName } from './normalize.ts';
import { findForbiddenIngredients } from './recipe-rules.ts';
import type { DishSuggestionDto, PreferencesDto, RawDishSuggestion } from './types.ts';

export type EnforceSuggestionModeInput = {
  /** What the model proposed, before anything has been verified. */
  suggestions: RawDishSuggestion[];
  /** Ingredient names the user actually has, in whatever spelling they typed. */
  pantry: string[];
  preferences: PreferencesDto;
};

export type EnforceSuggestionModeResult = {
  kept: DishSuggestionDto[];
  /** How many suggestions the rules removed. Surfaced so the UI can be honest. */
  filteredOut: number;
};

/**
 * Stable, readable id derived from the dish title.
 *
 * Exported because the recipe endpoint is stateless: it receives an id and a
 * title, and has to be able to tell that they refer to the same dish.
 */
export function suggestionIdFor(title: string): string {
  return normalizeIngredientName(title).replace(/[^a-z0-9ñ]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Enforces the active suggestion mode on what the model returned.
 *
 * This is the load-bearing piece of the feature. A prompt asking for
 * pantry-only recipes expresses an intent, not a guarantee: models comply most
 * of the time and then quietly add olive oil. So nothing the model claims is
 * trusted here - coverage and the matched/missing lists are recomputed from
 * the pantry, and a suggestion that breaks the rules is dropped.
 *
 * Pure function over data: no I/O, no model access, no clock. That is what
 * makes it testable against deliberately non-compliant fixtures.
 */
export function enforceSuggestionMode(
  input: EnforceSuggestionModeInput,
): EnforceSuggestionModeResult {
  const { preferences } = input;

  const available = new Set([
    ...input.pantry.map(normalizeIngredientName),
    ...preferences.staples.map(normalizeIngredientName),
  ]);
  const kept: DishSuggestionDto[] = [];
  let filteredOut = 0;

  for (const suggestion of input.suggestions) {
    // A dish with no ingredients cannot be checked against anything, so it is
    // rejected rather than accepted on the model's word.
    if (suggestion.ingredients.length === 0) {
      filteredOut += 1;
      continue;
    }

    // Optional ingredients are checked too: an allergy does not become safe
    // because the model called the ingredient optional. The rule itself lives
    // in recipe-rules, so suggestions and full recipes cannot drift apart.
    const forbidden = findForbiddenIngredients(
      suggestion.ingredients.map((ingredient) => ingredient.name),
      preferences,
    );
    if (forbidden.length > 0) {
      filteredOut += 1;
      continue;
    }

    const required = suggestion.ingredients.filter((ingredient) => !ingredient.optional);
    const matched = required.filter((ingredient) =>
      available.has(normalizeIngredientName(ingredient.name)),
    );
    const missing = required.filter(
      (ingredient) => !available.has(normalizeIngredientName(ingredient.name)),
    );

    const coverage = required.length === 0 ? 1 : matched.length / required.length;

    const allowed =
      preferences.suggestionMode === 'strict'
        ? missing.length === 0
        : missing.length <= preferences.maxMissingIngredients;

    if (!allowed) {
      filteredOut += 1;
      continue;
    }

    kept.push({
      id: suggestionIdFor(suggestion.title),
      title: suggestion.title,
      summary: suggestion.summary,
      matchedIngredients: matched.map((ingredient) => ingredient.name),
      missingIngredients: missing.map((ingredient) => ingredient.name),
      coverage,
      mode: preferences.suggestionMode,
    });
  }

  // Most cookable first: that is what makes the Discover screen useful rather
  // than a list the user has to scan.
  kept.sort((a, b) => b.coverage - a.coverage);

  return { kept, filteredOut };
}
