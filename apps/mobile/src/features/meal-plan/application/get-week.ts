import { startOfWeek } from '@recetapp/contracts';

import type { MealPlanEntryDto, MealPlanRepository } from '../domain/meal-plan-repository';

/**
 * Reads a week.
 *
 * Takes any day of that week and normalizes it, so callers never have to work
 * out which Monday they meant.
 */
export function makeGetWeek(repository: MealPlanRepository) {
  return async function getWeek(anyDayOfWeek: string): Promise<MealPlanEntryDto[]> {
    return repository.findByWeek(startOfWeek(anyDayOfWeek));
  };
}
