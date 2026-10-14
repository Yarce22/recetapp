import { weekDates } from '@recetapp/contracts';

import type {
  MealPlanEntryDto,
  MealPlanRepository,
  MealSlot,
} from '../domain/meal-plan-repository';

/** In-memory adapter, used by the tests and by the web build. */
export class InMemoryMealPlanRepository implements MealPlanRepository {
  private readonly entries = new Map<string, MealPlanEntryDto>();

  private key(date: string, slot: MealSlot) {
    return `${date}#${slot}`;
  }

  async findByWeek(weekStartDate: string): Promise<MealPlanEntryDto[]> {
    const days = new Set(weekDates(weekStartDate));
    return [...this.entries.values()]
      .filter((entry) => days.has(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findAll(): Promise<MealPlanEntryDto[]> {
    return [...this.entries.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async upsertMany(entries: MealPlanEntryDto[]): Promise<void> {
    for (const entry of entries) {
      this.entries.set(this.key(entry.date, entry.slot), entry);
    }
  }

  async clear(date: string, slot: MealSlot): Promise<void> {
    this.entries.delete(this.key(date, slot));
  }
}
