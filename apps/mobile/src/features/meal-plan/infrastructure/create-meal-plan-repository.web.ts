import type { MealPlanRepository } from '../domain/meal-plan-repository';

import { InMemoryMealPlanRepository } from './in-memory-meal-plan-repository';

/**
 * Web storage: in memory, like the rest of the web build.
 *
 * Keeps expo-sqlite out of the web bundle. The plan resets on reload.
 */
export async function createMealPlanRepository(): Promise<MealPlanRepository> {
  return new InMemoryMealPlanRepository();
}
