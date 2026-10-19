import { findMissingIngredients, scaleRecipe, type MealPlanEntryDto } from '@recetapp/contracts';

import { PLAN_SERVINGS } from '@/features/meal-plan/domain/plan-servings';

import type {
  RecipeRequestInput,
  RecipeResult,
  RecipeSuggestionService,
} from '../domain/recipe-suggestion-service';

export type ResolveRecipeInput = RecipeRequestInput & {
  /** The dish as planned, when it is on the menu. */
  planEntry?: MealPlanEntryDto;
};

/**
 * Loads a recipe, keeping the ingredients the menu already settled on.
 *
 * The model writes a fresh ingredient list on every recipe call, so without
 * this the recipe could disagree with the shopping list the user just built
 * from the menu. When the plan stored amounts, those replace the server's
 * ingredients (scaled from per serving to the servings on screen), and what
 * is missing is recomputed from them.
 *
 * The call itself is still needed: steps, time and difficulty are not part of
 * the menu. Skipping it would take an API that accepts the ingredients.
 */
export async function resolveRecipe(
  service: RecipeSuggestionService,
  input: ResolveRecipeInput,
): Promise<RecipeResult> {
  const { planEntry, ...request } = input;
  const stored = planEntry?.recipeIngredients;

  const result = await service.recipe({
    ...request,
    servings: request.servings ?? (stored ? PLAN_SERVINGS : undefined),
  });
  if (!stored) return result;

  const perServing = { ...result.recipe, servings: 1, ingredients: stored };
  const recipe = {
    ...result.recipe,
    ingredients: scaleRecipe(perServing, result.recipe.servings).ingredients,
  };

  return {
    recipe,
    missingIngredients: findMissingIngredients(
      recipe.ingredients.map((ingredient) => ingredient.name),
      request.pantry.map((entry) => entry.ingredient.name),
      request.preferences,
    ),
  };
}
