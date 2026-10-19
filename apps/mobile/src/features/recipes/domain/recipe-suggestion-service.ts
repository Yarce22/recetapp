import type {
  DishSuggestionDto,
  MealPlanEntryDto,
  MealSlot,
  PreferencesDto,
  Region,
  RecipeDto,
} from '@recetapp/contracts';

import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';

export type SuggestionResult = {
  suggestions: DishSuggestionDto[];
  /** How many the server's mode filter removed. */
  filteredOut: number;
};

export type RecipeResult = {
  recipe: RecipeDto;
  /** What the pantry cannot cover, as the server computed it. */
  missingIngredients: string[];
};

export type RecipeRequestInput = {
  id: string;
  title: string;
  pantry: PantryEntry[];
  preferences: PreferencesDto;
  /** Omit to get the recipe at whatever servings it proposes. */
  servings?: number;
};

export type MealPlanRequestInput = {
  pantry: PantryEntry[];
  preferences: PreferencesDto;
  slots: { date: string; slot: MealSlot }[];
  /** Dish titles already in the week, so a regenerated day stays varied. */
  exclude: string[];
  /** Regional cuisine to plan for. Defaults to Colombia. */
  region?: Region;
  /** When false (the default) the server must not repeat a dish. */
  allowRepeats?: boolean;
  /** Ask for each dish's ingredients with amounts in the same response. */
  includeIngredients?: boolean;
};

export type MealPlanResult = {
  entries: MealPlanEntryDto[];
  /** Slots the server could not fill without repeating a dish. */
  unfilled: { date: string; slot: MealSlot }[];
};

/**
 * Port for whatever produces dish suggestions and recipes.
 *
 * The app depends on this, never on Gemini. That is what keeps the decision to
 * route through our own backend reversible, and what lets the screens be built
 * and tested without a network.
 */
export interface RecipeSuggestionService {
  suggest(pantry: PantryEntry[], preferences: PreferencesDto): Promise<SuggestionResult>;
  recipe(input: RecipeRequestInput): Promise<RecipeResult>;
  planWeek(input: MealPlanRequestInput): Promise<MealPlanResult>;
}

/**
 * Why a request failed, as a stable code the UI turns into text.
 *
 * The message on the error is English and for logs; what the user reads is
 * chosen from the code at render time, in their language.
 */
export type SuggestionErrorCode =
  'unreachable' | 'suggest-failed' | 'recipe-failed' | 'plan-failed' | 'unreadable' | 'bad-shape';

/** Anything that stopped us getting suggestions, with nothing internal leaked. */
export class SuggestionServiceError extends Error {
  readonly code?: SuggestionErrorCode;

  constructor(message: string, code?: SuggestionErrorCode) {
    super(message);
    this.name = 'SuggestionServiceError';
    this.code = code;
  }
}

/**
 * Raised when the backend refused because the allowance is spent.
 *
 * Distinct from a generic failure because the user's next step is different:
 * waiting will fix this one, retrying now will not.
 */
export class RateLimitedError extends SuggestionServiceError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests. Try again shortly.');
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Raised when the recipe that came back breaks a dietary rule.
 *
 * Separate from a generic failure because it is not a glitch and retrying will
 * not help: the user needs to know the dish was withheld and why.
 */
export class RecipeRejectedError extends SuggestionServiceError {
  readonly ingredients: string[];

  constructor(ingredients: string[]) {
    super('That recipe uses something you asked to avoid.');
    this.name = 'RecipeRejectedError';
    this.ingredients = ingredients;
  }
}
