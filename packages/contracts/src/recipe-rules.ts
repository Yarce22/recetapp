import { normalizeIngredientName } from './normalize.ts';
import type { PreferencesDto, Quantity, RecipeDto, RecipeIngredientDto } from './types.ts';

/** Amounts are rounded to two decimals: finer than any kitchen scale. */
const PRECISION = 2;

/**
 * Smallest amount an ingredient can be scaled down to.
 *
 * Scaling a pinch of saffron for one serving can round to zero, and an
 * ingredient list that says "0 g saffron" is worse than useless - it tells the
 * cook to leave out something the dish needs.
 */
const MIN_AMOUNT = 0.01;

function round(amount: number): number {
  return Number(amount.toFixed(PRECISION));
}

/**
 * Names that the user asked never to be given.
 *
 * Matching is by substring, so avoiding "peanut" also rejects "peanut butter".
 * Returns the offending names as written, so a caller can say which ones.
 *
 * This runs wherever ingredients reach the user, not only on suggestions. A
 * dish that passed the filter can still come back with a full ingredient list
 * that did not.
 */
export function findForbiddenIngredients(
  ingredientNames: string[],
  preferences: PreferencesDto,
): string[] {
  const forbidden = preferences.dislikes
    .map(normalizeIngredientName)
    .filter((entry) => entry.length > 0);

  if (forbidden.length === 0) return [];

  return ingredientNames.filter((name) => {
    const normalized = normalizeIngredientName(name);
    return forbidden.some((entry) => normalized.includes(entry));
  });
}

/**
 * Ingredients the pantry cannot cover, counting enabled staples as available.
 */
export function findMissingIngredients(
  ingredientNames: string[],
  pantry: string[],
  preferences: PreferencesDto,
): string[] {
  const available = new Set([
    ...pantry.map(normalizeIngredientName),
    ...preferences.staples.map(normalizeIngredientName),
  ]);

  return ingredientNames.filter((name) => !available.has(normalizeIngredientName(name)));
}

function scaleQuantity(quantity: Quantity, factor: number): Quantity {
  return {
    amount: Math.max(MIN_AMOUNT, round(quantity.amount * factor)),
    unit: quantity.unit,
  };
}

/**
 * Restates a recipe for a different number of servings.
 *
 * Units are left alone: converting 1500 g into 1.5 kg would be prettier, but
 * it is a presentation decision and this is the data. The screen can format.
 *
 * Counted things can come out fractional - three quarters of an egg is real
 * arithmetic, not a bug - and that is left visible rather than silently
 * rounded to a whole, which would change the recipe.
 */
export function scaleRecipe(recipe: RecipeDto, toServings: number): RecipeDto {
  if (!Number.isFinite(toServings) || toServings <= 0) {
    throw new Error(`Servings must be a positive number, got ${toServings}.`);
  }
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) {
    throw new Error('Cannot scale a recipe that does not say how many it serves.');
  }

  if (toServings === recipe.servings) return recipe;

  const factor = toServings / recipe.servings;

  return {
    ...recipe,
    servings: toServings,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: scaleQuantity(ingredient.quantity, factor),
    })),
  };
}

const UNITS: readonly string[] = ['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'cup', 'pinch'];

/**
 * Reads an untrusted list of recipe ingredients, keeping the well formed ones.
 *
 * Used wherever the list crosses a boundary (a server response, a stored row):
 * the field is optional and may come from a build older or newer than this
 * one. Returns undefined when nothing usable is left, so callers can treat
 * "absent" and "unusable" the same way.
 */
export function parseRecipeIngredients(value: unknown): RecipeIngredientDto[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const valid = value.filter((item): item is RecipeIngredientDto => {
    if (item === null || typeof item !== 'object') return false;
    const candidate = item as Partial<RecipeIngredientDto>;
    return (
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      typeof candidate.optional === 'boolean' &&
      typeof candidate.quantity?.amount === 'number' &&
      Number.isFinite(candidate.quantity.amount) &&
      typeof candidate.quantity.unit === 'string' &&
      UNITS.includes(candidate.quantity.unit)
    );
  });

  return valid.length > 0 ? valid : undefined;
}
