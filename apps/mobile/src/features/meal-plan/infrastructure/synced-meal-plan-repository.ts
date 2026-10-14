import { encodeKey } from '@/shared/sync/sync-entities';
import { getSyncRecorder, type SyncRecorder } from '@/shared/sync/sync-recorder';

import type {
  MealPlanEntryDto,
  MealPlanRepository,
  MealSlot,
} from '../domain/meal-plan-repository';

/** The wire row of a plan entry. */
export function mealPlanEntryToRow(entry: MealPlanEntryDto): Record<string, unknown> {
  return {
    date: entry.date,
    slot: entry.slot,
    dish_id: entry.dishId,
    dish_title: entry.dishTitle,
    summary: entry.summary,
    ingredients: entry.ingredients,
  };
}

/**
 * Decorates the weekly plan so that, inside a household, every change is also
 * queued for sync. In solo mode the recorder does nothing and this behaves
 * exactly like the repository it wraps.
 */
export class SyncedMealPlanRepository implements MealPlanRepository {
  constructor(
    private readonly inner: MealPlanRepository,
    private readonly recorder: () => SyncRecorder = getSyncRecorder,
  ) {}

  findByWeek(weekStartDate: string): Promise<MealPlanEntryDto[]> {
    return this.inner.findByWeek(weekStartDate);
  }

  findAll(): Promise<MealPlanEntryDto[]> {
    return this.inner.findAll();
  }

  upsertMany(entries: MealPlanEntryDto[]): Promise<void> {
    return this.recorder().record(
      () => this.inner.upsertMany(entries),
      entries.map((entry) => ({
        entity: 'meal_plan_entries' as const,
        key: encodeKey([entry.date, entry.slot]),
        op: 'upsert' as const,
        row: mealPlanEntryToRow(entry),
      })),
    );
  }

  clear(date: string, slot: MealSlot): Promise<void> {
    return this.recorder().record(
      () => this.inner.clear(date, slot),
      [{ entity: 'meal_plan_entries', key: encodeKey([date, slot]), op: 'delete' }],
    );
  }
}
