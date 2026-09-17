import type { IngredientId } from '../domain/ingredient';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';

/**
 * In-memory adapter for the pantry port.
 *
 * Used by the use case tests, and usable by the UI before the SQLite adapter
 * lands. Because it satisfies the same port, swapping it for the real one
 * changes a single wiring line.
 */
export class InMemoryPantryRepository implements PantryRepository {
  private readonly entries = new Map<IngredientId, PantryEntry>();

  async findAll(): Promise<PantryEntry[]> {
    return [...this.entries.values()];
  }

  async findByIngredientId(id: IngredientId): Promise<PantryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async save(entry: PantryEntry): Promise<void> {
    this.entries.set(entry.ingredient.id, entry);
  }

  async remove(id: IngredientId): Promise<void> {
    this.entries.delete(id);
  }
}
