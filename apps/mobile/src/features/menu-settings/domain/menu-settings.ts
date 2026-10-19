import { DEFAULT_REGION, isRegion, type MealSlot, type Region } from '@recetapp/contracts';

export type MenuPeriod = 'weekly' | 'biweekly';

export const MENU_PERIODS: readonly MenuPeriod[] = ['weekly', 'biweekly'];

/** Every meal of the day, in the order they happen. */
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** How the menu is generated. Persisted per install, separate from dietary preferences. */
export type MenuSettings = {
  period: MenuPeriod;
  /** When false, no dish appears twice in the period. */
  allowRepeats: boolean;
  /** When true, the plan request also returns each dish's ingredients. */
  includeIngredients: boolean;
  /** Meals planned each day. Never empty. */
  slots: MealSlot[];
  region: Region;
};

/**
 * Starting point for a new install.
 *
 * All three meals because that is what a menu is; no repeats because a menu
 * that serves the same dish twice reads as a bug; ingredients off because they
 * make the answer larger and slower and the per-recipe call still works.
 */
export const DEFAULT_MENU_SETTINGS: MenuSettings = {
  period: 'weekly',
  allowRepeats: false,
  includeIngredients: false,
  slots: [...MEAL_SLOTS],
  region: DEFAULT_REGION,
};

export function periodWeeks(period: MenuPeriod): number {
  return period === 'biweekly' ? 2 : 1;
}

function parseSlots(value: unknown): MealSlot[] {
  if (!Array.isArray(value)) return [...DEFAULT_MENU_SETTINGS.slots];
  const picked = MEAL_SLOTS.filter((slot) => value.includes(slot));
  return picked.length > 0 ? picked : [...DEFAULT_MENU_SETTINGS.slots];
}

/**
 * Rebuilds menu settings from whatever was stored.
 *
 * Stored values are not trusted: a row can predate a field or come from a
 * newer build. Each field falls back to its own default, so one bad value
 * does not reset the rest.
 */
export function parseMenuSettings(raw: unknown): MenuSettings {
  if (raw === null || typeof raw !== 'object') return DEFAULT_MENU_SETTINGS;

  const stored = raw as Partial<Record<keyof MenuSettings, unknown>>;

  return {
    period:
      stored.period === 'weekly' || stored.period === 'biweekly'
        ? stored.period
        : DEFAULT_MENU_SETTINGS.period,
    allowRepeats:
      typeof stored.allowRepeats === 'boolean'
        ? stored.allowRepeats
        : DEFAULT_MENU_SETTINGS.allowRepeats,
    includeIngredients:
      typeof stored.includeIngredients === 'boolean'
        ? stored.includeIngredients
        : DEFAULT_MENU_SETTINGS.includeIngredients,
    slots: parseSlots(stored.slots),
    region: isRegion(stored.region) ? stored.region : DEFAULT_MENU_SETTINGS.region,
  };
}

/** Adds or removes a meal, keeping day order and never leaving none. */
export function toggleMealSlot(current: MealSlot[], slot: MealSlot): MealSlot[] {
  if (current.includes(slot)) {
    return current.length === 1 ? current : current.filter((entry) => entry !== slot);
  }
  return MEAL_SLOTS.filter((entry) => current.includes(entry) || entry === slot);
}
