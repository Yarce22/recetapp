import {
  InviteRejectedError,
  LocalDataDecisionRequired,
  SharingError,
} from '../../domain/household';
import {
  createDevice,
  pantryAmounts,
  pantryEntry,
  restartDevice,
  settle,
} from '../../testing/device';
import { FakeServer } from '../../testing/fake-server';

async function start(server: FakeServer, userId: string, options?: { available?: boolean }) {
  const device = createDevice(server, userId, options);
  await device.runtime.start();
  return device;
}

describe('solo mode', () => {
  it('stays exactly as it was: no queue, no account, no network', async () => {
    const server = new FakeServer();
    const device = await start(server, 'user-a');
    const calls = jest.spyOn(device.backend, 'pushRows');

    await device.pantry.save(pantryEntry('Milk', 2));
    await device.pantry.remove('milk');
    await device.ticks.check({ key: 'rice', name: 'Rice' });
    await settle();

    expect(await device.store.pendingCount()).toBe(0);
    expect(calls).not.toHaveBeenCalled();
    expect(device.runtime.getSnapshot()).toMatchObject({ household: null, available: true });
    expect(device.scheduler.delays()).toEqual([]);
  });

  it('reads back what it wrote, like the undecorated repository', async () => {
    const device = await start(new FakeServer(), 'user-a');

    await device.pantry.save(pantryEntry('Milk', 2));

    expect(await pantryAmounts(device)).toEqual({ milk: 2 });
    expect(await device.pantry.findByIngredientId('milk')).not.toBeNull();
  });
});

describe('sharing disabled (no Supabase configuration)', () => {
  it('reports itself unavailable and refuses every action without touching the network', async () => {
    const server = new FakeServer();
    const device = await start(server, 'user-a', { available: false });
    const calls = jest.spyOn(device.backend, 'createHousehold');

    expect(device.runtime.getSnapshot().available).toBe(false);
    await expect(device.service.createHousehold('Home')).rejects.toMatchObject({
      kind: 'unavailable',
    });
    await expect(device.service.joinHousehold('AAAA2222')).rejects.toBeInstanceOf(SharingError);
    expect(calls).not.toHaveBeenCalled();
  });

  it('keeps local writes working and unqueued', async () => {
    const device = await start(new FakeServer(), 'user-a', { available: false });

    await device.pantry.save(pantryEntry('Milk', 2));

    expect(await pantryAmounts(device)).toEqual({ milk: 2 });
    expect(await device.store.pendingCount()).toBe(0);
  });
});

describe('creating a household', () => {
  it('shares what the creator already has', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    await a.pantry.save(pantryEntry('Milk', 2));
    await a.ticks.check({ key: 'rice', name: 'Rice' });

    const created = await a.service.createHousehold('Home', 'Ana');
    await a.sync();
    const invite = await a.service.createInvite();
    await b.service.joinHousehold(invite.code);
    await b.sync();

    expect(created.role).toBe('owner');
    expect(await pantryAmounts(b)).toEqual({ milk: 2 });
    expect(await b.rawTicks.findAll()).toHaveLength(1);
  });

  it('refuses to create a second household', async () => {
    const a = await start(new FakeServer(), 'user-a');
    await a.service.createHousehold('Home');

    await expect(a.service.createHousehold('Other')).rejects.toBeInstanceOf(SharingError);
  });

  it('lists the members, flagging the caller', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    await a.service.createHousehold('Home', 'Ana');
    await b.service.joinHousehold((await a.service.createInvite()).code, { displayName: 'Beto' });

    const members = await a.service.listMembers();

    expect(members.map((m) => [m.displayName, m.role, m.isYou])).toEqual([
      ['Ana', 'owner', true],
      ['Beto', 'member', false],
    ]);
  });
});

describe('joining a household that already has data', () => {
  async function owner(server: FakeServer) {
    const a = await start(server, 'user-a');
    await a.service.createHousehold('Home');
    await a.pantry.save(pantryEntry('Milk', 2));
    await a.pantry.save(pantryEntry('Eggs', 12));
    await a.sync();
    return a;
  }

  it('asks what to do before touching anything when the device has local data', async () => {
    const server = new FakeServer();
    const a = await owner(server);
    const code = (await a.service.createInvite()).code;
    const b = await start(server, 'user-b');
    await b.pantry.save(pantryEntry('Rice', 1));

    await expect(b.service.joinHousehold(code)).rejects.toBeInstanceOf(LocalDataDecisionRequired);

    // Nothing was consumed or changed: the invite still works, the data is intact.
    expect(b.runtime.getSnapshot().household).toBeNull();
    expect(await pantryAmounts(b)).toEqual({ rice: 1 });
    expect(await a.service.listInvites()).toHaveLength(1);
  });

  it('uploads local items on request, merging with what the household has', async () => {
    const server = new FakeServer();
    const a = await owner(server);
    const b = await start(server, 'user-b');
    await b.pantry.save(pantryEntry('Rice', 1));
    await b.pantry.save(pantryEntry('Milk', 99)); // collides with the household's milk

    await b.service.joinHousehold((await a.service.createInvite()).code, { localData: 'upload' });
    await b.sync();
    await a.sync();

    // The household's version wins on a collision; the rest is added.
    expect(await pantryAmounts(b)).toEqual({ rice: 1, milk: 2, eggs: 12 });
    expect(await pantryAmounts(a)).toEqual({ rice: 1, milk: 2, eggs: 12 });
  });

  it('discards local items on request and adopts the household copy', async () => {
    const server = new FakeServer();
    const a = await owner(server);
    const b = await start(server, 'user-b');
    await b.pantry.save(pantryEntry('Rice', 1));
    await b.ticks.check({ key: 'salt', name: 'Salt' });
    const before = b.engine.getStatus().remoteRevision;

    await b.service.joinHousehold((await a.service.createInvite()).code, { localData: 'discard' });
    await b.sync();
    await a.sync();

    expect(await pantryAmounts(b)).toEqual({ milk: 2, eggs: 12 });
    expect(await b.rawTicks.findAll()).toEqual([]);
    expect(await pantryAmounts(a)).toEqual({ milk: 2, eggs: 12 }); // rice never reached them
    expect(b.engine.getStatus().remoteRevision).toBeGreaterThan(before);
  });

  it('needs no decision when the device is empty', async () => {
    const server = new FakeServer();
    const a = await owner(server);
    const b = await start(server, 'user-b');

    await b.service.joinHousehold((await a.service.createInvite()).code);
    await b.sync();

    expect(await pantryAmounts(b)).toEqual({ milk: 2, eggs: 12 });
  });

  it('uploads local items even if the device was offline right after joining', async () => {
    const server = new FakeServer();
    const a = await owner(server);
    const b = await start(server, 'user-b');
    await b.pantry.save(pantryEntry('Rice', 1));
    await b.service.joinHousehold((await a.service.createInvite()).code, { localData: 'upload' });

    b.backend.online = false;
    await b.sync();
    b.backend.online = true;
    await b.scheduler.runAll();
    await a.sync();

    expect(await pantryAmounts(a)).toEqual({ rice: 1, milk: 2, eggs: 12 });
  });
});

describe('invite codes', () => {
  it('rejects an unknown code and leaves the device untouched', async () => {
    const server = new FakeServer();
    const b = await start(server, 'user-b');
    await b.pantry.save(pantryEntry('Rice', 1));

    await expect(b.service.joinHousehold('ZZZZ9999', { localData: 'discard' })).rejects.toEqual(
      expect.objectContaining({ reason: 'invalid' }),
    );

    expect(await pantryAmounts(b)).toEqual({ rice: 1 });
    expect(b.runtime.getSnapshot().household).toBeNull();
  });

  it('does not even ask the server about a code that cannot exist', async () => {
    const b = await start(new FakeServer(), 'user-b');
    const call = jest.spyOn(b.backend, 'joinHousehold');

    await expect(b.service.joinHousehold('ABC0O1')).rejects.toBeInstanceOf(InviteRejectedError);

    expect(call).not.toHaveBeenCalled();
  });

  it('accepts a code typed with spaces, dashes and lower case', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    await a.service.createHousehold('Home');
    const code = (await a.service.createInvite()).code;

    await b.service.joinHousehold(` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `);

    expect(b.runtime.getSnapshot().household?.name).toBe('Home');
  });

  it('rejects an expired code', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    await a.service.createHousehold('Home');
    const code = (await a.service.createInvite()).code;
    server.expireInvites();

    await expect(b.service.joinHousehold(code)).rejects.toBeInstanceOf(InviteRejectedError);
  });

  it('rejects a revoked code', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    await a.service.createHousehold('Home');
    const invite = await a.service.createInvite();
    await a.service.revokeInvite(invite.id);

    await expect(b.service.joinHousehold(invite.code)).rejects.toBeInstanceOf(InviteRejectedError);
  });

  it('is single use', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    const c = await start(server, 'user-c');
    await a.service.createHousehold('Home');
    const code = (await a.service.createInvite()).code;

    await b.service.joinHousehold(code);

    await expect(c.service.joinHousehold(code)).rejects.toBeInstanceOf(InviteRejectedError);
  });
});

describe('leaving a household', () => {
  async function shared() {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    const b = await start(server, 'user-b');
    const home = await a.service.createHousehold('Home');
    await b.service.joinHousehold((await a.service.createInvite()).code);
    await a.pantry.save(pantryEntry('Milk', 2));
    await a.sync();
    await b.sync();
    return { server, a, b, home };
  }

  it('keeps a solo copy by default and stops sharing from then on', async () => {
    const { server, a, b, home } = await shared();

    await b.service.leaveHousehold();
    await b.pantry.save(pantryEntry('Rice', 1));
    await a.pantry.save(pantryEntry('Eggs', 12));
    await a.sync();
    await b.sync();
    await settle();

    expect(b.runtime.getSnapshot().household).toBeNull();
    expect(await pantryAmounts(b)).toEqual({ milk: 2, rice: 1 }); // the copy it had, plus solo edits
    expect(await b.store.pendingCount()).toBe(0);
    expect(
      server
        .live(home.id, 'pantry_items')
        .map((r) => r.ingredient_id)
        .sort(),
    ).toEqual(['eggs', 'milk']);
    expect(await pantryAmounts(a)).toEqual({ milk: 2, eggs: 12 }); // the others keep theirs
  });

  it('can discard the local copy instead', async () => {
    const { a, b } = await shared();

    await b.service.leaveHousehold({ localData: 'discard' });

    expect(await pantryAmounts(b)).toEqual({});
    expect(await pantryAmounts(a)).toEqual({ milk: 2 });
  });

  it('hands over pending edits before leaving', async () => {
    const { a, b } = await shared();
    await b.pantry.save(pantryEntry('Tea', 1)); // queued, not yet pushed

    await b.service.leaveHousehold({ localData: 'discard' });
    await a.sync();

    expect(await pantryAmounts(a)).toEqual({ milk: 2, tea: 1 });
  });

  it('stays in the household when the network is down, and keeps syncing afterwards', async () => {
    const { a, b } = await shared();
    b.backend.online = false;

    await expect(b.service.leaveHousehold()).rejects.toMatchObject({ kind: 'offline' });
    expect(b.runtime.getSnapshot().household).not.toBeNull();

    b.backend.online = true;
    await b.pantry.save(pantryEntry('Tea', 1));
    await b.sync();
    await a.sync();
    expect(await pantryAmounts(a)).toEqual({ milk: 2, tea: 1 });
  });

  it('lets the same device join another household afterwards', async () => {
    const { server, b } = await shared();
    await b.service.leaveHousehold();

    const c = await start(server, 'user-c');
    await c.service.createHousehold('Other');
    await b.service.joinHousehold((await c.service.createInvite()).code, { localData: 'discard' });

    expect(b.runtime.getSnapshot().household?.name).toBe('Other');
  });

  it('removes only the caller from the household', async () => {
    const { server, a, b, home } = await shared();

    await b.service.leaveHousehold();

    expect(server.isMember(home.id, 'user-a')).toBe(true);
    expect(server.isMember(home.id, 'user-b')).toBe(false);
    expect((await a.service.listMembers()).map((m) => m.userId)).toEqual(['user-a']);
  });
});

describe('losing the membership', () => {
  it('falls back to solo mode with the local copy when the server no longer knows the device', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    await a.service.createHousehold('Home');
    await a.pantry.save(pantryEntry('Milk', 2));
    await a.sync();

    // The anonymous session was lost and the device came back as someone else.
    a.backend.userId = 'user-new';
    await a.pantry.save(pantryEntry('Eggs', 12));
    await a.sync();
    await settle();

    expect(a.runtime.getSnapshot()).toMatchObject({ household: null, membershipLost: true });
    expect(await pantryAmounts(a)).toEqual({ milk: 2, eggs: 12 });
    expect(await a.store.pendingCount()).toBe(0);

    a.service.dismissMembershipLost();
    expect(a.runtime.getSnapshot().membershipLost).toBe(false);
  });
});

describe('restoring after a restart', () => {
  it('remembers the household and does not ask for anything again', async () => {
    const server = new FakeServer();
    const a = await start(server, 'user-a');
    await a.service.createHousehold('Home');

    const restarted = restartDevice(a);
    const calls = jest.spyOn(restarted.backend, 'createHousehold');
    await restarted.runtime.start();

    expect(restarted.runtime.getSnapshot().household?.name).toBe('Home');
    expect(calls).not.toHaveBeenCalled();
  });
});
