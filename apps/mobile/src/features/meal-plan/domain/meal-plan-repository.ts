import type { MealPlanEntryDto, MealSlot } from '@recetapp/contracts';

export type { MealPlanEntryDto, MealSlot };

/**
 * Port for the weekly plan.
 *
 * Entries are keyed by the day and the meal, so there is no separate plan
 * entity to keep in sync: a week is just the entries whose date falls in it.
 */
export interface MealPlanRepository {
  findByWeek(weekStartDate: string): Promise<MealPlanEntryDto[]>;
  /** Every stored entry, whatever its week. Used to share the plan, not by screens. */
  findAll(): Promise<MealPlanEntryDto[]>;
  upsertMany(entries: MealPlanEntryDto[]): Promise<void>;
  clear(date: string, slot: MealSlot): Promise<void>;
}
