import {
  normalizeIngredientName,
  type PreferencesDto,
  type SuggestionMode,
} from '@recetapp/contracts';

export type { PreferencesDto, SuggestionMode };

const MAX_MISSING_ALLOWED = 20;

/**
 * Starting point for a new install.
 *
 * Strict is the default because the surprising answer is the other one:
 * someone opening a pantry app expects to be told what they can cook now, not
 * what they could cook after a trip to the shop.
 *
 * The staples exist so strict mode is usable at all. Without them nearly every
 * real recipe gets rejected over salt.
 */
export const DEFAULT_PREFERENCES: PreferencesDto = {
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['water', 'salt', 'pepper', 'cooking oil'],
  dietary: [],
  dislikes: [],
};

function stringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rebuilds preferences from whatever was stored.
 *
 * Stored settings are not trusted: the row can predate a schema change, or
 * have been written by an older build. Anything unusable falls back to the
 * default rather than propagating into a request the server would reject.
 */
export function parsePreferences(raw: unknown): PreferencesDto {
  if (raw === null || typeof raw !== 'object') return DEFAULT_PREFERENCES;

  const stored = raw as Partial<Record<keyof PreferencesDto, unknown>>;

  const mode: SuggestionMode =
    stored.suggestionMode === 'strict' || stored.suggestionMode === 'flexible'
      ? stored.suggestionMode
      : DEFAULT_PREFERENCES.suggestionMode;

  const allowance =
    typeof stored.maxMissingIngredients === 'number' &&
    Number.isFinite(stored.maxMissingIngredients)
      ? clamp(Math.round(stored.maxMissingIngredients), 0, MAX_MISSING_ALLOWED)
      : DEFAULT_PREFERENCES.maxMissingIngredients;

  return {
    suggestionMode: mode,
    maxMissingIngredients: allowance,
    staples: Array.isArray(stored.staples)
      ? stringList(stored.staples, DEFAULT_PREFERENCES.staples)
      : DEFAULT_PREFERENCES.staples,
    dietary: stringList(stored.dietary, DEFAULT_PREFERENCES.dietary),
    dislikes: stringList(stored.dislikes, DEFAULT_PREFERENCES.dislikes),
  };
}

/**
 * Turns a staple on or off.
 *
 * Comparison goes through the shared normalization, so a staple the user typed
 * differently is recognised as the same one rather than added twice.
 */
export function toggleStaple(preferences: PreferencesDto, staple: string): PreferencesDto {
  const target = normalizeIngredientName(staple);
  const present = preferences.staples.some((entry) => normalizeIngredientName(entry) === target);

  return {
    ...preferences,
    staples: present
      ? preferences.staples.filter((entry) => normalizeIngredientName(entry) !== target)
      : [...preferences.staples, staple.trim()],
  };
}
