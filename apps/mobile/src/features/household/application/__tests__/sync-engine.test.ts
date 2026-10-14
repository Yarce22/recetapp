import { encodeKey } from '@/shared/sync/sync-entities';

import { SharingError } from '../../domain/household';
import {
  createDevice,
  pantryAmounts,
  pantryEntry,
  restartDevice,
  settle,
  type Device,
} from '../../testing/device';
import { FakeServer } from '../../testing/fake-server';

async function household() {
  const server = new FakeServer();
  const a = createDevice(server, 'user-a');
  const b = createDevice(server, 'user-b');
  await a.runtime.start();
  await b.runtime.start();

  const created = await a.service.createHousehold('Home');
  const invite = await a.service.createInvite();
  await b.service.joinHousehold(invite.code);
  await a.sync();
  await b.sync();
  return { server, a, b, id: created.id };
}

async function addMeal(device: Device, date: string, slot: 'lunch' | 'dinner', title: string) {
  await device.plan.upsertMany([
    { date, slot, dishId: `dish-${title}`, dishTitle: title, summary: 's', ingredients: ['rice'] },
  ]);
}

describe('sync engine: two devices', () => {
  it('shows a change made on one phone on the other', async () => {
    const { a, b } = await household();

    await a.pantry.save(pantryEntry('Milk', 2));
    await a.sync();
    await b.sync();

    expect(await pantryAmounts(b)).toEqual({ milk: 2 });
  });

  it('carries the weekly menu and the shopping ticks too', async () => {
    const { a, b } = await household();

    await addMeal(a, '2026-10-12', 'dinner', 'Soup');
    await a.ticks.check({ key: 'rice', name: 'Rice' });
    await a.sync();
    await b.sync();

    expect((await b.rawPlan.findByWeek('2026-10-12')).map((e) => e.dishTitle)).toEqual(['Soup']);
    expect(await b.rawTicks.findAll()).toEqual([{ key: 'rice', name: 'Rice' }]);

    await b.ticks.uncheck('rice');
    await b.sync();
    await a.sync();
    expect(await a.rawTicks.findAll()).toEqual([]);
  });

  it('delivers changes live through realtime, without waiting for a pull', async () => {
    const { a, b } = await household();
    const before = b.engine.getStatus().remoteRevision;

    await a.pantry.save(pantryEntry('Eggs', 6));
    await a.sync(); // pushes; the server broadcasts to B on its own
    await settle();

    expect(await pantryAmounts(b)).toEqual({ eggs: 6 });
    expect(b.engine.getStatus().remoteRevision).toBeGreaterThan(before);
  });

  it('does not treat the echo of its own push as a remote change', async () => {
    const { a } = await household();
    await a.sync();
    const before = a.engine.getStatus().remoteRevision;

    await a.pantry.save(pantryEntry('Salt', 1));
    await a.sync();
    await settle();

    expect(a.engine.getStatus().remoteRevision).toBe(before);
  });

  it('converges when both edit the same item: the last push wins everywhere', async () => {
    const { a, b } = await household();
    await a.pantry.save(pantryEntry('Flour', 1));
    await a.sync();
    await b.sync();

    // Both go offline and edit the same item.
    a.backend.online = false;
    b.backend.online = false;
    await a.pantry.save(pantryEntry('Flour', 5));
    await b.pantry.save(pantryEntry('Flour', 9));

    // B reconnects first, A second: A's write reaches the server last.
    b.backend.online = true;
    await b.sync();
    a.backend.online = true;
    await a.sync();
    await b.sync();

    expect(await pantryAmounts(a)).toEqual({ flour: 5 });
    expect(await pantryAmounts(b)).toEqual({ flour: 5 });
  });

  it('keeps an unpushed local edit even when a newer remote version arrives first', async () => {
    const { a, b } = await household();
    await a.pantry.save(pantryEntry('Rice', 1));
    await a.sync();
    await b.sync();

    a.backend.online = false;
    await a.pantry.save(pantryEntry('Rice', 3)); // queued on A

    await b.pantry.save(pantryEntry('Rice', 7));
    await b.sync();

    // A comes back: its pull must not overwrite the queued edit.
    a.backend.online = true;
    await a.sync();
    await b.sync();

    expect(await pantryAmounts(a)).toEqual({ rice: 3 });
    expect(await pantryAmounts(b)).toEqual({ rice: 3 });
  });

  describe('delete versus edit', () => {
    it('lets a later edit bring a deleted item back', async () => {
      const { a, b } = await household();
      await a.pantry.save(pantryEntry('Tofu', 1));
      await a.sync();
      await b.sync();

      a.backend.online = false;
      b.backend.online = false;
      await a.pantry.remove('tofu');
      await b.pantry.save(pantryEntry('Tofu', 4));

      a.backend.online = true;
      await a.sync(); // the delete reaches the server first
      b.backend.online = true;
      await b.sync(); // the edit arrives later and wins
      await a.sync();

      expect(await pantryAmounts(a)).toEqual({ tofu: 4 });
      expect(await pantryAmounts(b)).toEqual({ tofu: 4 });
    });

    it('lets a later delete remove an item that was edited', async () => {
      const { a, b } = await household();
      await a.pantry.save(pantryEntry('Tofu', 1));
      await a.sync();
      await b.sync();

      a.backend.online = false;
      b.backend.online = false;
      await a.pantry.remove('tofu');
      await b.pantry.save(pantryEntry('Tofu', 4));

      b.backend.online = true;
      await b.sync();
      a.backend.online = true;
      await a.sync();
      await b.sync();

      expect(await pantryAmounts(a)).toEqual({});
      expect(await pantryAmounts(b)).toEqual({});
    });

    it('propagates a delete as a tombstone and keeps it from resurrecting', async () => {
      const { server, a, b, id } = await household();
      await a.pantry.save(pantryEntry('Jam', 1));
      await a.sync();
      await b.sync();

      await a.pantry.remove('jam');
      await a.sync();
      await b.sync();
      await b.sync(); // the pull overlap re-reads the tombstone and the old rows

      expect(await pantryAmounts(b)).toEqual({});
      expect(server.row(id, 'pantry_items', encodeKey(['jam']))?.deleted).toBe(true);
    });
  });
});

describe('sync engine: offline and failures', () => {
  it('never blocks a local write on the network', async () => {
    const { a } = await household();
    a.backend.online = false;

    await a.pantry.save(pantryEntry('Beans', 2));

    expect(await pantryAmounts(a)).toEqual({ beans: 2 });
    expect(await a.store.pendingCount()).toBe(1);
  });

  it('replays writes made offline once the network is back', async () => {
    const { server, a, b, id } = await household();
    a.backend.online = false;

    await a.pantry.save(pantryEntry('Beans', 2));
    await a.pantry.save(pantryEntry('Lentils', 1));
    await addMeal(a, '2026-10-13', 'lunch', 'Stew');
    await a.sync();

    expect(a.engine.getStatus()).toMatchObject({ state: 'offline', pending: 3, error: 'offline' });
    expect(server.live(id, 'pantry_items')).toHaveLength(0);

    a.backend.online = true;
    await a.scheduler.runAll(); // the retry timer fires

    expect(a.engine.getStatus()).toMatchObject({ state: 'synced', pending: 0, error: null });
    await b.sync();
    expect(await pantryAmounts(b)).toEqual({ beans: 2, lentils: 1 });
    expect(await b.rawPlan.findAll()).toHaveLength(1);
  });

  it('coalesces repeated edits to one record into a single queued change', async () => {
    const { a } = await household();
    a.backend.online = false;

    await a.pantry.save(pantryEntry('Milk', 1));
    await a.pantry.save(pantryEntry('Milk', 2));
    await a.pantry.save(pantryEntry('Milk', 3));

    expect(await a.store.pendingCount()).toBe(1);
  });

  it('retries with exponential backoff and resets after a success', async () => {
    const { a } = await household();
    a.backend.online = false;
    await a.pantry.save(pantryEntry('Oil', 1));

    await a.sync();
    expect(a.scheduler.delays()).toEqual([2_000]);
    await a.scheduler.runAll();
    expect(a.scheduler.delays()).toEqual([4_000]);
    await a.scheduler.runAll();
    expect(a.scheduler.delays()).toEqual([8_000]);

    a.backend.online = true;
    await a.scheduler.runAll();
    expect(a.engine.getStatus().state).toBe('synced');

    a.backend.online = false;
    await a.pantry.save(pantryEntry('Oil', 2));
    await a.sync();
    expect(a.scheduler.delays()).toEqual([2_000]);
  });

  it('does not hammer a server that is failing: local changes wait for the retry timer', async () => {
    const { a } = await household();
    a.backend.online = false;
    await a.pantry.save(pantryEntry('Oil', 1));
    await a.sync();
    const scheduled = a.scheduler.delays();

    await a.pantry.save(pantryEntry('Oil', 2));
    await settle();

    expect(a.scheduler.delays()).toEqual(scheduled);
    expect(a.engine.getStatus().pending).toBe(1);
  });

  it('debounces a burst of local edits into one push', async () => {
    const { server, a } = await household();
    server.pushCalls = 0;

    await a.pantry.save(pantryEntry('Oil', 1));
    await a.pantry.save(pantryEntry('Salt', 1));
    await a.pantry.save(pantryEntry('Rice', 1));
    expect(a.scheduler.delays()).toEqual([400]);

    await a.scheduler.runAll();
    expect(server.pushCalls).toBe(1);
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('is idempotent when the acknowledgement is lost', async () => {
    const { server, a, id } = await household();
    await a.pantry.save(pantryEntry('Sugar', 2));

    // The server stores the row, but the response never makes it back.
    const original = a.backend.pushRows.bind(a.backend);
    a.backend.pushRows = async (entity, householdId, rows) => {
      await original(entity, householdId, rows);
      throw new SharingError('offline', 'response lost');
    };
    await a.sync();
    const stamped = server.row(id, 'pantry_items', encodeKey(['sugar']))?.updated_at;
    expect(a.engine.getStatus().pending).toBe(1);

    a.backend.pushRows = original;
    await a.scheduler.runAll();

    expect(a.engine.getStatus()).toMatchObject({ state: 'synced', pending: 0 });
    // The retry changed nothing on the server, so nothing was re-stamped.
    expect(server.row(id, 'pantry_items', encodeKey(['sugar']))?.updated_at).toBe(stamped);
    expect(server.live(id, 'pantry_items')).toHaveLength(1);
  });

  it('drops a record the server refuses for good without blocking the rest', async () => {
    const { server, a, b } = await household();
    server.rejectTitle = 'BAD';

    await addMeal(a, '2026-10-12', 'lunch', 'Good one');
    await addMeal(a, '2026-10-12', 'dinner', 'BAD');
    await addMeal(a, '2026-10-13', 'lunch', 'Another good one');
    await a.sync();
    await b.sync();

    expect(a.engine.getStatus()).toMatchObject({ state: 'synced', pending: 0, rejected: 1 });
    const titles = (await b.rawPlan.findAll()).map((entry) => entry.dishTitle).sort();
    expect(titles).toEqual(['Another good one', 'Good one']);
  });

  it('refreshes the session once on an auth error and carries on', async () => {
    const { a, b } = await household();
    await a.pantry.save(pantryEntry('Tea', 1));

    a.backend.failNext = 'auth';
    await a.sync();

    expect(a.backend.refreshCalls).toBe(1);
    expect(a.engine.getStatus()).toMatchObject({ state: 'synced', pending: 0 });
    await b.sync();
    expect(await pantryAmounts(b)).toEqual({ tea: 1 });
  });

  it('reports an error state, not offline, when the server fails', async () => {
    const { a } = await household();
    a.backend.failNext = 'server';

    await a.sync();

    expect(a.engine.getStatus()).toMatchObject({ state: 'error', error: 'server' });
  });

  it('pulls every page of a large household', async () => {
    const { a, b } = await household();
    for (let i = 0; i < 520; i += 1) await a.ticks.check({ key: `item-${i}`, name: `Item ${i}` });
    await a.sync();
    await b.sync();

    expect(await b.rawTicks.findAll()).toHaveLength(520);
  });
});

describe('sync engine: lifecycle', () => {
  it('stops syncing and queues nothing after leaving the household', async () => {
    const { server, a, id } = await household();
    await a.service.leaveHousehold();

    await a.pantry.save(pantryEntry('Honey', 1));
    await settle();

    expect(await a.store.pendingCount()).toBe(0);
    expect(server.live(id, 'pantry_items')).toHaveLength(0);
    expect(a.engine.getStatus().state).toBe('synced');
  });

  it('resumes from the stored membership after the app restarts', async () => {
    const { a, b } = await household();
    await a.pantry.save(pantryEntry('Cocoa', 1));
    await a.sync();

    const restarted = restartDevice(b);
    await restarted.runtime.start();
    await restarted.sync();

    expect(restarted.runtime.getSnapshot().household?.name).toBe('Home');
    expect(await pantryAmounts(restarted)).toEqual({ cocoa: 1 });
  });
});
