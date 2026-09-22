import type { SQLiteDatabase } from 'expo-sqlite';

import { weekDates } from '@recetapp/contracts';

import type {
  MealPlanEntryDto,
  MealPlanRepository,
  MealSlot,
} from '../domain/meal-plan-repository';

type MealPlanRow = {
  date: string;
  slot: string;
  dish_id: string;
  dish_title: string;
  summary: string;
  /** JSON array of ingredient names. */
  ingredients: string;
};

/**
 * Reads the stored ingredient list.
 *
 * A row written before the column existed carries the default '[]', and a row
 * that somehow holds something else yields an empty list rather than throwing:
 * a plan that cannot feed the shopping list is still a usable plan.
 */
function parseIngredients(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const SELECT_WEEK =
  'SELECT * FROM meal_plan_entries WHERE date BETWEEN ? AND ? ORDER BY date, slot';
const DELETE_ONE = 'DELETE FROM meal_plan_entries WHERE date = ? AND slot = ?';
const UPSERT = `
  INSERT INTO meal_plan_entries (date, slot, dish_id, dish_title, summary, ingredients)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(date, slot) DO UPDATE SET
    dish_id     = excluded.dish_id,
    dish_title  = excluded.dish_title,
    summary     = excluded.summary,
    ingredients = excluded.ingredients
`;

/** SQLite adapter. Every statement is parameterized. */
export class SqliteMealPlanRepository implements MealPlanRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async findByWeek(weekStartDate: string): Promise<MealPlanEntryDto[]> {
    const days = weekDates(weekStartDate);
    // ISO dates sort and compare as text, which is the point of the format.
    const rows = await this.db.getAllAsync<MealPlanRow>(SELECT_WEEK, [days[0], days[6]]);

    return rows.map((row) => ({
      date: row.date,
      slot: row.slot as MealSlot,
      dishId: row.dish_id,
      dishTitle: row.dish_title,
      summary: row.summary,
      ingredients: parseIngredients(row.ingredients),
    }));
  }

  async upsertMany(entries: MealPlanEntryDto[]): Promise<void> {
    for (const entry of entries) {
      await this.db.runAsync(UPSERT, [
        entry.date,
        entry.slot,
        entry.dishId,
        entry.dishTitle,
        entry.summary,
        JSON.stringify(entry.ingredients),
      ]);
    }
  }

  async clear(date: string, slot: MealSlot): Promise<void> {
    await this.db.runAsync(DELETE_ONE, [date, slot]);
  }
}
