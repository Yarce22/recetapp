import { enforceSuggestionMode, suggestionIdFor } from './enforce-suggestion-mode.ts';
import { normalizeIngredientName } from './normalize.ts';
import type { MealPlanEntryDto, MealSlot, PreferencesDto, RawDishSuggestion } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a calendar date without letting a timezone near it.
 *
 * Dates here are calendar facts - "Tuesday's dinner" - not instants. Parsing
 * "2026-09-22" with `new Date(...)` gives midnight UTC, which is the previous
 * evening in any negative offset, and the plan silently shifts by a day. The
 * parts are read by hand and rebuilt in UTC so the arithmetic is pure.
 */
function toUtcDate(isoDate: string): Date {
  if (!ISO_DATE.test(isoDate)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${isoDate}".`);
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC rolls invalid values over silently: month 13 becomes January of
  // the next year. Comparing back catches that.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`"${isoDate}" is not a real calendar date.`);
  }

  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The Monday of the week containing the given date.
 *
 * Weeks start on Monday, so Sunday belongs to the week that is ending rather
 * than the one about to begin - which is how people talk about their week of
 * meals.
 */
export function startOfWeek(isoDate: string): string {
  const date = toUtcDate(isoDate);
  const dayOfWeek = date.getUTCDay(); // 0 is Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return toIsoDate(date);
}

/** The seven calendar dates of the week containing the given date. */
export function weekDates(isoDate: string): string[] {
  const monday = toUtcDate(startOfWeek(isoDate));

  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + offset);
    return toIsoDate(day);
  });
}

/**
 * The Mondays of `weeks` consecutive weeks, starting with the week that
 * contains the given date. A biweekly menu is two of these.
 */
export function weekStarts(isoDate: string, weeks: number): string[] {
  const monday = toUtcDate(startOfWeek(isoDate));

  return Array.from({ length: Math.max(1, Math.floor(weeks)) }, (_, offset) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + offset * 7);
    return toIsoDate(day);
  });
}

export type MealPlanSlotRequest = {
  date: string;
  slot: MealSlot;
};

export type BuildMealPlanInput = {
  /** What the model proposed, before anything has been verified. */
  proposals: RawDishSuggestion[];
  /** The day and slot pairs to fill, in the order they should be filled. */
  slots: MealPlanSlotRequest[];
  /** Dish titles already placed elsewhere in the week. */
  exclude: string[];
  preferences: PreferencesDto;
  /** Let a dish fill more than one slot. Defaults to false. */
  allowRepeats?: boolean;
  /** Attach each dish's ingredients with amounts to its entries. */
  includeIngredients?: boolean;
};

export type BuildMealPlanResult = {
  entries: MealPlanEntryDto[];
  /** Slots left empty. Reported rather than padded with repeats. */
  unfilled: MealPlanSlotRequest[];
};

/**
 * Turns proposed dishes into a week, enforcing variety.
 *
 * Two rules, both deterministic, because a prompt asking for variety is a
 * request and not a guarantee:
 *
 * - unless `allowRepeats` is set, every dish appears at most once, matched through the shared name
 *   normalization so "Pasta" and "pasta" are the same dish
 * - anything already placed elsewhere in the week is skipped, which is what
 *   makes regenerating a single day keep the rest of the week varied
 *
 * A slot with no dish left is reported as unfilled. Padding the week with
 * repeats would technically fill it and quietly produce the exact thing the
 * user asked a meal planner to avoid.
 */
export function buildMealPlan(input: BuildMealPlanInput): BuildMealPlanResult {
  // The week is not limited by what is in the pantry: the shopping list exists
  // to cover the difference. Dislikes and dietary rules still apply, through
  // the same gate the Discover screen uses, so a dish that is not safe to
  // suggest is not safe to plan either. Only the pantry-based mode is lifted,
  // and what the dish needs is kept whole for that shopping list to work from.
  const { kept } = enforceSuggestionMode({
    suggestions: input.proposals,
    pantry: [],
    preferences: {
      ...input.preferences,
      suggestionMode: 'flexible',
      maxMissingIngredients: Number.POSITIVE_INFINITY,
    },
  });

  const used = new Set(input.exclude.map(normalizeIngredientName));
  const entries: MealPlanEntryDto[] = [];
  const unfilled: MealPlanSlotRequest[] = [];

  const detailed = new Map(
    input.proposals.map((proposal) => [normalizeIngredientName(proposal.title), proposal]),
  );

  const available = kept.filter((suggestion) => {
    const key = normalizeIngredientName(suggestion.title);
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });

  let next = 0;
  for (const slot of input.slots) {
    // With repeats allowed the dishes are dealt out in rotation, so the week
    // stays as varied as the proposals allow without leaving gaps.
    const suggestion = input.allowRepeats
      ? available[next % Math.max(available.length, 1)]
      : available[next];
    if (!suggestion) {
      unfilled.push(slot);
      continue;
    }

    next += 1;
    const recipeIngredients = input.includeIngredients
      ? (detailed.get(normalizeIngredientName(suggestion.title))?.ingredients ?? []).flatMap(
          (ingredient) =>
            ingredient.quantity
              ? [
                  {
                    name: ingredient.name,
                    quantity: ingredient.quantity,
                    optional: ingredient.optional,
                  },
                ]
              : [],
        )
      : undefined;
    entries.push({
      date: slot.date,
      slot: slot.slot,
      dishId: suggestionIdFor(suggestion.title),
      dishTitle: suggestion.title,
      summary: suggestion.summary,
      // Already known here. Throwing it away would cost a model call per dish
      // later, when the shopping list asks what the week needs.
      ingredients: [...suggestion.matchedIngredients, ...suggestion.missingIngredients],
      ...(recipeIngredients && recipeIngredients.length > 0 ? { recipeIngredients } : {}),
    });
  }

  return { entries, unfilled };
}
