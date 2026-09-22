import { type MealSlot } from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';
import type { RecipeSuggestionService } from '@/features/recipes/domain/recipe-suggestion-service';

import type { MealPlanRepository } from '../domain/meal-plan-repository';

export type GenerateWeekInput = {
  weekStartDate: string;
  slots: { date: string; slot: MealSlot }[];
  pantry: PantryEntry[];
  preferences: PreferencesDto;
};

export type GenerateWeekResult = {
  unfilled: { date: string; slot: MealSlot }[];
};

/**
 * Plans a whole week from scratch.
 *
 * Nothing is excluded: the week is being replaced, so every dish is fair game
 * again. Variety inside the new week is the server's job.
 */
export function makeGenerateWeek(repository: MealPlanRepository, service: RecipeSuggestionService) {
  return async function generateWeek(input: GenerateWeekInput): Promise<GenerateWeekResult> {
    const result = await service.planWeek({
      pantry: input.pantry,
      preferences: input.preferences,
      slots: input.slots,
      exclude: [],
    });

    await repository.upsertMany(result.entries);
    return { unfilled: result.unfilled };
  };
}
