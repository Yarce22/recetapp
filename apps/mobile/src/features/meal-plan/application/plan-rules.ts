import { normalizeIngredientName, type MealPlanEntryDto, type MealSlot } from '@recetapp/contracts';

type Slot = { date: string; slot: MealSlot };

/**
 * Removes any dish that already appears earlier in the plan or in `taken`.
 *
 * The server is told not to repeat dishes and enforces it too, but this is the
 * last line before the plan is stored: an old server, or a model that renamed
 * a dish slightly, must not put a repeat in front of a user who turned repeats
 * off. Dropped dishes come back as unfilled slots, never as silent gaps.
 */
export function dropRepeatedDishes(
  entries: MealPlanEntryDto[],
  taken: string[] = [],
): { kept: MealPlanEntryDto[]; dropped: Slot[] } {
  const used = new Set(taken.map(normalizeIngredientName));
  const kept: MealPlanEntryDto[] = [];
  const dropped: Slot[] = [];

  for (const entry of entries) {
    const key = normalizeIngredientName(entry.dishTitle);
    if (used.has(key)) {
      dropped.push({ date: entry.date, slot: entry.slot });
      continue;
    }
    used.add(key);
    kept.push(entry);
  }

  return { kept, dropped };
}
