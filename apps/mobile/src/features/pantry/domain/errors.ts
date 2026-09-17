/** Raised when an amount is not a usable number. */
export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityError';
  }
}

/**
 * Raised when two units cannot be related to each other.
 *
 * This is deliberately loud. Silently guessing that 200 g of flour is 200 ml
 * produces recipes that do not work, and the failure would surface in the
 * kitchen rather than in the code.
 */
export class IncompatibleUnitsError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot convert ${from} to ${to}: the units measure different things.`);
    this.name = 'IncompatibleUnitsError';
  }
}

/** Raised when an ingredient cannot be identified. */
export class InvalidIngredientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidIngredientError';
  }
}

/** Raised when an operation targets an ingredient the pantry does not hold. */
export class PantryItemNotFoundError extends Error {
  constructor(ingredientId: string) {
    super(`No pantry item for ingredient "${ingredientId}".`);
    this.name = 'PantryItemNotFoundError';
  }
}
