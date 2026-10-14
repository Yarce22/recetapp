import { encodeKey } from '@/shared/sync/sync-entities';
import { getSyncRecorder, type SyncRecorder } from '@/shared/sync/sync-recorder';

import type { IngredientId } from '../domain/ingredient';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';

import { entryToRow } from './pantry-mappers';

/**
 * Decorates the pantry so that, inside a household, every change is also
 * queued for sync. In solo mode the recorder does nothing and this behaves
 * exactly like the repository it wraps.
 */
export class SyncedPantryRepository implements PantryRepository {
  constructor(
    private readonly inner: PantryRepository,
    private readonly recorder: () => SyncRecorder = getSyncRecorder,
  ) {}

  findAll(): Promise<PantryEntry[]> {
    return this.inner.findAll();
  }

  findByIngredientId(id: IngredientId): Promise<PantryEntry | null> {
    return this.inner.findByIngredientId(id);
  }

  save(entry: PantryEntry): Promise<void> {
    const row = entryToRow(entry);
    return this.recorder().record(
      () => this.inner.save(entry),
      [{ entity: 'pantry_items', key: encodeKey([row.ingredient_id]), op: 'upsert', row }],
    );
  }

  remove(id: IngredientId): Promise<void> {
    return this.recorder().record(
      () => this.inner.remove(id),
      [{ entity: 'pantry_items', key: encodeKey([id]), op: 'delete' }],
    );
  }
}
