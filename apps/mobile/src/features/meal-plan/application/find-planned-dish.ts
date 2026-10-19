import type { MealPlanEntryDto, MealPlanRepository } from '../domain/meal-plan-repository';

/**
 * Finds a planned dish by id, in whatever week it was planned.
 *
 * The recipe screen only knows the dish id from its route. A dish can sit in
 * several slots when repeats are allowed, so the occurrence that carries
 * ingredient amounts wins: any of them describes the same dish.
 */
export function makeFindPlannedDish(repository: MealPlanRepository) {
  return async function findPlannedDish(dishId: string): Promise<MealPlanEntryDto | undefined> {
    const matches = (await repository.findAll()).filter((entry) => entry.dishId === dishId);
    return matches.find((entry) => entry.recipeIngredients) ?? matches[0];
  };
}
