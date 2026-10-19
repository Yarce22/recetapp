import { DEFAULT_REGION, type MealSlot, type Region } from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import type { PreferencesDto } from '@/features/preferences/domain/preferences';
import type { RecipeSuggestionService } from '@/features/recipes/domain/recipe-suggestion-service';

import type { MealPlanRepository } from '../domain/meal-plan-repository';

import { dropRepeatedDishes } from './plan-rules';

export type RegenerateDayInput = {
  /** The week the day belongs to. */
  weekStartDate: string;
  /**
   * Every week of the plan, when it spans more than one. Dishes planned in any
   * of them count as already used. Defaults to just `weekStartDate`.
   */
  weekStartDates?: string[];
  date: string;
  slots: MealSlot[];
  pantry: PantryEntry[];
  preferences: PreferencesDto;
  /** Defaults to false: no dish twice in the plan. */
  allowRepeats?: boolean;
  /** Defaults to false. */
  includeIngredients?: boolean;
  /** Defaults to Colombia. */
  region?: Region;
};

export type RegenerateDayResult = {
  unfilled: { date: string; slot: MealSlot }[];
};

/**
 * Replaces one day without disturbing the rest of the plan.
 *
 * Everything already planned on the OTHER days is sent as an exclusion, which
 * is what stops "give me something else for Tuesday" from handing back
 * Thursday's dinner. The day being replaced is not excluded: its current dish
 * is the thing the user is trying to get rid of, and barring it would only
 * shrink the choices. With repeats allowed nothing is excluded.
 */
export function makeRegenerateDay(
  repository: MealPlanRepository,
  service: RecipeSuggestionService,
) {
  return async function regenerateDay(input: RegenerateDayInput): Promise<RegenerateDayResult> {
    const allowRepeats = input.allowRepeats ?? false;
    const weeks = input.weekStartDates ?? [input.weekStartDate];

    const planned = (await Promise.all(weeks.map((week) => repository.findByWeek(week)))).flat();
    const exclude = allowRepeats
      ? []
      : planned.filter((entry) => entry.date !== input.date).map((entry) => entry.dishTitle);

    const result = await service.planWeek({
      pantry: input.pantry,
      preferences: input.preferences,
      slots: input.slots.map((slot) => ({ date: input.date, slot })),
      exclude,
      region: input.region ?? DEFAULT_REGION,
      allowRepeats,
      includeIngredients: input.includeIngredients ?? false,
    });

    const { kept, dropped } = allowRepeats
      ? { kept: result.entries, dropped: [] }
      : dropRepeatedDishes(result.entries, exclude);

    await repository.upsertMany(kept);

    // A slot the server could not refill is emptied rather than left showing
    // the dish the user just asked to replace.
    const unfilled = [...result.unfilled, ...dropped];
    for (const slot of unfilled) {
      await repository.clear(slot.date, slot.slot);
    }

    return { unfilled };
  };
}
