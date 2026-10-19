import { DEFAULT_REGION, type MealSlot, type Region } from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';
import type { RecipeSuggestionService } from '@/features/recipes/domain/recipe-suggestion-service';

import type { MealPlanRepository } from '../domain/meal-plan-repository';

import { dropRepeatedDishes } from './plan-rules';

export type GenerateWeekInput = {
  weekStartDate: string;
  slots: { date: string; slot: MealSlot }[];
  pantry: PantryEntry[];
  preferences: PreferencesDto;
  /** Defaults to false: no dish twice in the plan. */
  allowRepeats?: boolean;
  /** Defaults to false. */
  includeIngredients?: boolean;
  /** Defaults to Colombia. */
  region?: Region;
};

export type GenerateWeekResult = {
  unfilled: { date: string; slot: MealSlot }[];
};

/**
 * Plans a whole period (one week, or two) from scratch.
 *
 * Nothing is excluded: the plan is being replaced, so every dish is fair game
 * again. Variety inside the new plan is the server's job, double-checked here
 * unless the user allowed repeats.
 */
export function makeGenerateWeek(repository: MealPlanRepository, service: RecipeSuggestionService) {
  return async function generateWeek(input: GenerateWeekInput): Promise<GenerateWeekResult> {
    const allowRepeats = input.allowRepeats ?? false;

    const result = await service.planWeek({
      pantry: input.pantry,
      preferences: input.preferences,
      slots: input.slots,
      exclude: [],
      region: input.region ?? DEFAULT_REGION,
      allowRepeats,
      includeIngredients: input.includeIngredients ?? false,
    });

    const { kept, dropped } = allowRepeats
      ? { kept: result.entries, dropped: [] }
      : dropRepeatedDishes(result.entries);

    await repository.upsertMany(kept);
    return { unfilled: [...result.unfilled, ...dropped] };
  };
}
