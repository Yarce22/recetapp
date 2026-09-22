/**
 * Contracts shared by the mobile app and the BFF.
 *
 * One definition of every request and response, so a backend change that
 * breaks the app fails at compile time instead of at runtime on a phone.
 */

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unit' | 'tbsp' | 'tsp' | 'cup' | 'pinch';

export type Quantity = {
  amount: number;
  unit: Unit;
};

/**
 * How much freedom the model has when proposing dishes.
 *
 * `strict`   - only ingredients in the pantry, plus the enabled staples
 * `flexible` - may introduce ingredients the user would have to buy
 *
 * Note this is a request-side intent only. It is enforced server-side after
 * the model responds; see `enforceSuggestionMode`.
 */
export type SuggestionMode = 'strict' | 'flexible';

export type PantryEntryDto = {
  name: string;
  quantity: Quantity;
};

export type PreferencesDto = {
  suggestionMode: SuggestionMode;
  /** Only meaningful when suggestionMode is 'flexible'. */
  maxMissingIngredients: number;
  /** Basics assumed to be available, so strict mode stays usable. */
  staples: string[];
  dietary: string[];
  dislikes: string[];
};

export type RecipeIngredientDto = {
  name: string;
  quantity: Quantity;
  optional: boolean;
};

/** One ingredient of a dish the model proposed, before verification. */
export type RawSuggestionIngredient = {
  name: string;
  optional: boolean;
};

/**
 * A dish exactly as the model returned it.
 *
 * Deliberately carries no coverage or matched/missing lists: those are facts
 * about the user's pantry, and the model is not a source of truth about that.
 * They are computed by `enforceSuggestionMode`.
 */
export type RawDishSuggestion = {
  title: string;
  summary: string;
  ingredients: RawSuggestionIngredient[];
};

export type DishSuggestionDto = {
  id: string;
  title: string;
  summary: string;
  matchedIngredients: string[];
  missingIngredients: string[];
  /** Fraction of required ingredients already in the pantry, 0 to 1. */
  coverage: number;
  mode: SuggestionMode;
};

export type SuggestionsRequest = {
  pantry: PantryEntryDto[];
  preferences: PreferencesDto;
};

export type SuggestionsResponse = {
  suggestions: DishSuggestionDto[];
  /** How many the mode filter removed. Surfaced so the UI can be honest. */
  filteredOut: number;
};

export type RecipeDto = {
  id: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredientDto[];
  steps: string[];
  timeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
};

/**
 * Request for the full recipe of a dish.
 *
 * Carries the title, the pantry and the preferences because the BFF is
 * stateless: it has no record of which suggestion an id referred to, and the
 * dietary rules have to be enforced again on the complete ingredient list.
 */
export type RecipeRequest = {
  title: string;
  pantry: PantryEntryDto[];
  preferences: PreferencesDto;
  /** Defaults to whatever the recipe itself proposes. */
  servings?: number;
};

export type RecipeResponse = {
  recipe: RecipeDto;
  /** What the pantry cannot cover, recomputed server-side. */
  missingIngredients: string[];
};

/** Which meal of the day a plan entry belongs to. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export type MealPlanEntryDto = {
  /** Calendar date as YYYY-MM-DD. A stored instant would shift across timezones. */
  date: string;
  slot: MealSlot;
  dishId: string;
  dishTitle: string;
  summary: string;
  /**
   * Ingredient names the dish needs, as the model listed them when the week
   * was planned.
   *
   * Kept on the entry so the shopping list is a local computation. Deriving it
   * from the recipes instead would mean fetching every recipe in the week -
   * seven model calls to answer a question we already had the data for.
   *
   * These are the suggestion-level ingredients, which can differ in detail
   * from the full recipe. Good enough to shop from, not a substitute for
   * opening the recipe.
   */
  ingredients: string[];
};

export type MealPlanDto = {
  /** The Monday of the week, as YYYY-MM-DD. */
  weekStartDate: string;
  entries: MealPlanEntryDto[];
};

export type MealPlanRequest = {
  pantry: PantryEntryDto[];
  preferences: PreferencesDto;
  /** Day and slot pairs to fill. One day's worth when regenerating a day. */
  slots: { date: string; slot: MealSlot }[];
  /** Dish titles already in the week, so a regenerated day stays varied. */
  exclude: string[];
};

export type MealPlanResponse = {
  entries: MealPlanEntryDto[];
  /** Slots the rules could not fill. Reported rather than padded with repeats. */
  unfilled: { date: string; slot: MealSlot }[];
};
