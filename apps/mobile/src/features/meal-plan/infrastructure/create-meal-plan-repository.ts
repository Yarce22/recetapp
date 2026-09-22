import { getDatabase } from '@/shared/db/client';

import type { MealPlanRepository } from '../domain/meal-plan-repository';

import { SqliteMealPlanRepository } from './sqlite-meal-plan-repository';

/** Native storage: the same SQLite database the pantry uses. */
export async function createMealPlanRepository(): Promise<MealPlanRepository> {
  const db = await getDatabase();
  return new SqliteMealPlanRepository(db);
}
