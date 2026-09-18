import { normalizeIngredientName } from '@recetapp/contracts';

import { InvalidIngredientError } from './errors';
import type { Unit } from './units';

export type IngredientId = string;

export type IngredientCategory = 'produce' | 'dairy' | 'meat' | 'grain' | 'spice' | 'other';

export type Ingredient = {
  id: IngredientId;
  /** Normalized form, used for matching against recipes. */
  name: string;
  /** What the user typed, used for display. */
  displayName: string;
  category: IngredientCategory;
  defaultUnit: Unit;
};

/**
 * Re-exported from the shared kernel.
 *
 * The BFF compares recipe ingredients against the pantry names this app sends,
 * so both sides must normalize identically. A second copy here would not fail
 * loudly if the two drifted - it would quietly produce wrong matches.
 */
export { normalizeIngredientName };

export type CreateIngredientInput = {
  id: IngredientId;
  name: string;
  category: IngredientCategory;
  defaultUnit: Unit;
};

export function createIngredient(input: CreateIngredientInput): Ingredient {
  const name = normalizeIngredientName(input.name);
  if (name.length === 0) {
    throw new InvalidIngredientError('An ingredient needs a name.');
  }

  return {
    id: input.id,
    name,
    displayName: input.name.trim().replace(/\s+/g, ' '),
    category: input.category,
    defaultUnit: input.defaultUnit,
  };
}
