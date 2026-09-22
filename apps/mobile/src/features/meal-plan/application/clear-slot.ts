import type { MealPlanRepository, MealSlot } from '../domain/meal-plan-repository';

export type ClearSlotInput = {
  date: string;
  slot: MealSlot;
};

export function makeClearSlot(repository: MealPlanRepository) {
  return async function clearSlot(input: ClearSlotInput): Promise<void> {
    await repository.clear(input.date, input.slot);
  };
}
