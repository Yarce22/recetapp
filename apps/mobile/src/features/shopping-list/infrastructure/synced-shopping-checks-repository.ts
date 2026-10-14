import { encodeKey } from '@/shared/sync/sync-entities';
import { getSyncRecorder, type SyncRecorder } from '@/shared/sync/sync-recorder';

import type { ShoppingCheck, ShoppingChecksRepository } from '../domain/shopping-checks-repository';

/**
 * Decorates the ticks repository so that, inside a household, every change is
 * also queued for sync. In solo mode the recorder does nothing and this behaves
 * exactly like the repository it wraps.
 */
export class SyncedShoppingChecksRepository implements ShoppingChecksRepository {
  constructor(
    private readonly inner: ShoppingChecksRepository,
    private readonly recorder: () => SyncRecorder = getSyncRecorder,
  ) {}

  findAll(): Promise<ShoppingCheck[]> {
    return this.inner.findAll();
  }

  check(item: ShoppingCheck): Promise<void> {
    return this.recorder().record(
      () => this.inner.check(item),
      [
        {
          entity: 'shopping_items',
          key: encodeKey([item.key]),
          op: 'upsert',
          row: { item_key: item.key, name: item.name },
        },
      ],
    );
  }

  uncheck(key: string): Promise<void> {
    return this.recorder().record(
      () => this.inner.uncheck(key),
      [{ entity: 'shopping_items', key: encodeKey([key]), op: 'delete' }],
    );
  }
}
