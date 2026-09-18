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
