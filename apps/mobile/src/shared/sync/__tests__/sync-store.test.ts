import { InMemorySyncStore } from '../in-memory-sync-store';
import { Mutex } from '../mutex';
import { liveRow, tombstoneRow } from '../sync-entities';
import { createSyncRecorder, soloRecorder } from '../sync-recorder';

describe('sync store outbox', () => {
  it('keeps one entry per record and replaces it with the newer change', async () => {
    const store = new InMemorySyncStore();

    await store.enqueue('pantry_items', '["milk"]', 'upsert', { amount: 1 });
    await store.enqueue('pantry_items', '["milk"]', 'delete', { deleted: true });

    const pending = await store.pending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].op).toBe('delete');
  });

  it('only acknowledges the revision that was pushed', async () => {
    const store = new InMemorySyncStore();
    await store.enqueue('pantry_items', '["milk"]', 'upsert', { amount: 1 });
    const [pushed] = await store.pending(10);

    // The person edits again while the push is in flight.
    await store.enqueue('pantry_items', '["milk"]', 'upsert', { amount: 2 });
    await store.acknowledge('pantry_items', '["milk"]', pushed.rev);

    expect(await store.isDirty('pantry_items', '["milk"]')).toBe(true);
    expect((await store.pending(10))[0].row).toEqual({ amount: 2 });
  });

  it('returns the oldest changes first and respects the limit', async () => {
    const store = new InMemorySyncStore();
    await store.enqueue('pantry_items', '["a"]', 'upsert', {});
    await store.enqueue('pantry_items', '["b"]', 'upsert', {});
    await store.enqueue('pantry_items', '["a"]', 'upsert', {});

    expect((await store.pending(1)).map((e) => e.key)).toEqual(['["b"]']);
  });

  it('forgets everything on reset', async () => {
    const store = new InMemorySyncStore();
    await store.enqueue('pantry_items', '["a"]', 'upsert', {});
    await store.setMeta('pantry_items', '["a"]', { updatedAt: 'x', deleted: false });
    await store.setState('cursor', '1');

    await store.reset();

    expect(await store.pendingCount()).toBe(0);
    expect(await store.getMeta('pantry_items', '["a"]')).toBeNull();
    expect(await store.getState('cursor')).toBeNull();
  });
});

describe('wire rows', () => {
  it('builds a tombstone with no stale data', () => {
    expect(tombstoneRow('meal_plan_entries', '["2026-10-12","dinner"]')).toEqual({
      date: '2026-10-12',
      slot: 'dinner',
      dish_id: null,
      dish_title: null,
      summary: null,
      ingredients: null,
      deleted: true,
    });
  });

  it('keeps only synced columns on a live row', () => {
    expect(liveRow('shopping_items', { item_key: 'rice', name: 'Rice', local_only: 1 })).toEqual({
      item_key: 'rice',
      name: 'Rice',
      deleted: false,
    });
  });
});

describe('sync recorder', () => {
  it('passes straight through in solo mode', async () => {
    const write = jest.fn(async () => undefined);

    await soloRecorder.record(write, [{ entity: 'pantry_items', key: '["a"]', op: 'delete' }]);

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not queue when the device is not in a household', async () => {
    const store = new InMemorySyncStore();
    const onQueued = jest.fn();
    const recorder = createSyncRecorder({
      store,
      lock: new Mutex(),
      isActive: () => false,
      onQueued,
    });

    await recorder.record(
      async () => undefined,
      [{ entity: 'pantry_items', key: '["a"]', op: 'delete' }],
    );

    expect(await store.pendingCount()).toBe(0);
    expect(onQueued).not.toHaveBeenCalled();
  });

  it('queues nothing when the local write fails', async () => {
    const store = new InMemorySyncStore();
    const recorder = createSyncRecorder({
      store,
      lock: new Mutex(),
      isActive: () => true,
      onQueued: jest.fn(),
    });

    await expect(
      recorder.record(async () => {
        throw new Error('disk full');
      }, [{ entity: 'pantry_items', key: '["a"]', op: 'delete' }]),
    ).rejects.toThrow('disk full');

    expect(await store.pendingCount()).toBe(0);
  });
});

describe('Mutex', () => {
  it('runs tasks one at a time in order, even after a failure', async () => {
    const lock = new Mutex();
    const order: string[] = [];

    const first = lock.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('first');
      throw new Error('boom');
    });
    const second = lock.run(async () => {
      order.push('second');
    });

    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual(['first', 'second']);
  });
});
