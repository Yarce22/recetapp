import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

import { InviteRejectedError } from '../../domain/household';
import { FakeBackend, FakeServer } from '../../testing/fake-server';
import { createHouseholdRepository, HOUSEHOLD_SETTING_KEY } from '../household-repository';

function setup() {
  const server = new FakeServer();
  const settings = new InMemorySettingsRepository();
  const backend = new FakeBackend(server, 'user-a');
  const repository = createHouseholdRepository({
    backend,
    settings,
    now: () => new Date('2026-10-12T12:00:00.000Z'),
  });
  return { server, settings, backend, repository };
}

describe('household repository', () => {
  it('creates a household as its owner without remembering it yet', async () => {
    const { repository, settings } = setup();

    const household = await repository.create('  Our   home ', '  Ana ');

    expect(household).toMatchObject({ name: 'Our home', role: 'owner' });
    expect(await repository.getCurrent()).toBeNull();
    expect(await settings.get(HOUSEHOLD_SETTING_KEY)).toBeNull();
  });

  it('rejects a blank name', async () => {
    const { repository } = setup();

    await expect(repository.create('   ', null)).rejects.toMatchObject({ kind: 'rejected' });
  });

  it('remembers and forgets the household', async () => {
    const { repository } = setup();
    const household = await repository.create('Home', null);

    await repository.remember(household);
    expect(await repository.getCurrent()).toEqual(household);

    await repository.forget();
    expect(await repository.getCurrent()).toBeNull();
  });

  it('treats a corrupted record as no household', async () => {
    const { repository, settings } = setup();
    await settings.set(HOUSEHOLD_SETTING_KEY, '{"id": 5');

    expect(await repository.getCurrent()).toBeNull();
  });

  it('refuses a malformed code without calling the server', async () => {
    const { repository, backend } = setup();
    const call = jest.spyOn(backend, 'joinHousehold');

    await expect(repository.join('short', null)).rejects.toBeInstanceOf(InviteRejectedError);
    expect(call).not.toHaveBeenCalled();
  });

  it('normalizes the code before sending it', async () => {
    const { repository, server } = setup();
    const owner = new FakeBackend(server, 'user-owner');
    const id = await owner.createHousehold('Home', null);
    const invite = await owner.createInvite(id);

    const joined = await repository.join(
      `${invite.code.slice(0, 4).toLowerCase()} ${invite.code.slice(4)}`,
      null,
    );

    expect(joined).toMatchObject({ id, name: 'Home', role: 'member' });
  });
});
