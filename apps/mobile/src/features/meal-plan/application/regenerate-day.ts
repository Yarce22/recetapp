import { type MealSlot } from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';
import type { RecipeSuggestionService } from '@/features/recipes/domain/recipe-suggestion-service';

import type { MealPlanRepository } from '../domain/meal-plan-repository';

export type RegenerateDayInput = {
  weekStartDate: string;
  date: string;
  slots: MealSlot[];
  pantry: PantryEntry[];
  preferences: PreferencesDto;
};

export type RegenerateDayResult = {
  unfilled: { date: string; slot: MealSlot }[];
};

/**
 * Replaces one day without disturbing the rest of the week.
 *
 * Everything already planned on the OTHER days is sent as an exclusion, which
 * is what stops "give me something else for Tuesday" from handing back
 * Thursday's dinner. The day being replaced is not excluded: its current dish
 * is the thing the user is trying to get rid of, and barring it would only
 * shrink the choices.
 */
export function makeRegenerateDay(
  repository: MealPlanRepository,
  service: RecipeSuggestionService,
) {
  return async function regenerateDay(input: RegenerateDayInput): Promise<RegenerateDayResult> {
    const week = await repository.findByWeek(input.weekStartDate);
    const exclude = week
      .filter((entry) => entry.date !== input.date)
      .map((entry) => entry.dishTitle);

    const result = await service.planWeek({
      pantry: input.pantry,
      preferences: input.preferences,
      slots: input.slots.map((slot) => ({ date: input.date, slot })),
      exclude,
    });

    await repository.upsertMany(result.entries);

    // A slot the server could not refill is emptied rather than left showing
    // the dish the user just asked to replace.
    for (const slot of result.unfilled) {
      await repository.clear(slot.date, slot.slot);
    }

    return { unfilled: result.unfilled };
  };
}
