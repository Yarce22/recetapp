import type { IngredientId, Ingredient } from './ingredient';
import type { PantryItem } from './pantry-item';

/** A pantry item together with the ingredient it refers to. */
export type PantryEntry = {
  ingredient: Ingredient;
  item: PantryItem;
};

/**
 * Port for pantry persistence.
 *
 * Declared here in the domain and implemented in infrastructure, so use cases
 * depend on this interface rather than on SQLite. Swapping local storage for a
 * synced backend later is an adapter change, not a feature rewrite.
 */
export interface PantryRepository {
  findAll(): Promise<PantryEntry[]>;
  findByIngredientId(id: IngredientId): Promise<PantryEntry | null>;
  save(entry: PantryEntry): Promise<void>;
  remove(id: IngredientId): Promise<void>;
}
