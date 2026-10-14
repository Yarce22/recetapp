import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Share } from 'react-native';

import type { Language } from '@recetapp/contracts';

import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

import {
  InviteRejectedError,
  LocalDataDecisionRequired,
  SharingError,
  type SharingErrorKind,
} from '../../domain/household';
import {
  fakeService,
  HOME,
  invite,
  ME,
  SAM,
  SharingTestProvider,
  sharingValue,
  type FakeService,
  type SharingValueOverrides,
} from '../../testing/fake-sharing';
import { HouseholdScreen } from '../household-screen';

async function renderScreen(overrides: SharingValueOverrides = {}, language: Language = 'en') {
  const onClose = jest.fn();
  const value = sharingValue(overrides);
  const view = (current: typeof value): ReactElement => (
    <SharingTestProvider value={current}>
      <HouseholdScreen onClose={onClose} />
    </SharingTestProvider>
  );
  const result = await renderInLanguage(view(value), language);
  await act(async () => {});
  return {
    ...result,
    onClose,
    // Keeps the same service, as the real hook does between snapshots.
    update: (next: SharingValueOverrides) =>
      result.rerender(view(sharingValue({ service: value.service, ...next }))),
  };
}

const typeInto = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

describe('HouseholdScreen: not available or not ready', () => {
  it('says so when sharing is not set up in this build', async () => {
    await renderScreen({ available: false, service: null });

    expect(screen.getByText('Sharing is not available in this version of the app.')).toBeTruthy();
    expect(screen.queryByText('Create a household')).toBeNull();
  });

  it('shows a loading state until the runtime is ready', async () => {
    await renderScreen({ ready: false, service: null });

    expect(screen.getByText('Loading your household…')).toBeTruthy();
    expect(screen.queryByText('Create a household')).toBeNull();
  });

  it('closes from the header', async () => {
    const { onClose } = await renderScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('HouseholdScreen: no household yet', () => {
  it('offers to create one or join with a code', async () => {
    await renderScreen();

    expect(screen.getByText('Create a household')).toBeTruthy();
    expect(screen.getByText('Join with a code')).toBeTruthy();
  });

  it('creates a household with a trimmed name and an optional display name', async () => {
    const service = fakeService();
    await renderScreen({ service });
    const create = screen.getByRole('button', { name: 'Create household' });
    expect(create.props.accessibilityState.disabled).toBe(true);

    typeInto('Household name', '  Home  ');
    typeInto('Your name (optional)', ' Alex ');
    fireEvent.press(screen.getByRole('button', { name: 'Create household' }));

    await waitFor(() => expect(service.createHousehold).toHaveBeenCalledWith('Home', 'Alex'));
  });

  it('sends no display name when the field is left empty', async () => {
    const service = fakeService();
    await renderScreen({ service });

    typeInto('Household name', 'Home');
    fireEvent.press(screen.getByRole('button', { name: 'Create household' }));

    await waitFor(() => expect(service.createHousehold).toHaveBeenCalledWith('Home', null));
  });

  it('formats the invite code as it is typed and limits it to eight characters', async () => {
    await renderScreen();

    typeInto('Invite code', 'abcdefghjk');

    expect(screen.getByLabelText('Invite code').props.value).toBe('ABCD-EFGH');
  });

  it('keeps Join disabled, with a hint, until the code is complete and valid', async () => {
    await renderScreen();
    const join = () => screen.getByRole('button', { name: 'Join household' });
    expect(join().props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText('Enter all 8 characters of the code.')).toBeNull();

    typeInto('Invite code', 'abc');
    expect(screen.getByText('Enter all 8 characters of the code.')).toBeTruthy();
    expect(join().props.accessibilityState.disabled).toBe(true);

    // 0 and O are not in the alphabet.
    typeInto('Invite code', 'ABCD-EFG0');
    expect(join().props.accessibilityState.disabled).toBe(true);

    typeInto('Invite code', 'abcd efgh');
    expect(join().props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('Enter all 8 characters of the code.')).toBeNull();
  });

  it('joins with the normalized code', async () => {
    const service = fakeService();
    await renderScreen({ service });

    typeInto('Invite code', 'abcd-efgh');
    typeInto('Your name (optional)', 'Sam');
    fireEvent.press(screen.getByRole('button', { name: 'Join household' }));

    await waitFor(() =>
      expect(service.joinHousehold).toHaveBeenCalledWith('ABCDEFGH', { displayName: 'Sam' }),
    );
  });

  it('disables both actions while one is running', async () => {
    let finish: () => void = () => undefined;
    const service = fakeService({
      createHousehold: jest.fn(() => new Promise((resolve) => (finish = () => resolve(HOME)))),
    });
    await renderScreen({ service });
    typeInto('Household name', 'Home');
    typeInto('Invite code', 'ABCDEFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Create household' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Join household' }).props.accessibilityState.disabled,
      ).toBe(true),
    );
    await act(async () => finish());
  });

  it.each([
    ['invalid', 'That code is not valid. It may have expired or been used.'],
    ['throttled', 'Too many attempts. Wait a few minutes and try again.'],
    ['already_member', 'You are already in a household.'],
    ['full', 'That household is full.'],
  ] as const)('explains a refused code (%s)', async (reason, message) => {
    const service = fakeService({
      joinHousehold: jest.fn().mockRejectedValue(new InviteRejectedError(reason)),
    });
    await renderScreen({ service });

    typeInto('Invite code', 'ABCDEFGH');
    fireEvent.press(screen.getByRole('button', { name: 'Join household' }));

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it.each<[SharingErrorKind, string]>([
    ['offline', 'You are offline. Check your connection and try again.'],
    ['auth', 'Your session expired. Try again.'],
    ['forbidden', 'You are not allowed to do that in this household.'],
    ['rejected', 'The server refused that request.'],
    ['server', 'The server had a problem. Try again later.'],
    ['unavailable', 'Sharing is not available in this version of the app.'],
  ])('explains a failed create (%s)', async (kind, message) => {
    const service = fakeService({
      createHousehold: jest.fn().mockRejectedValue(new SharingError(kind, 'detail')),
    });
    await renderScreen({ service });

    typeInto('Household name', 'Home');
    fireEvent.press(screen.getByRole('button', { name: 'Create household' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText('detail')).toBeNull();
  });

  it('shows a generic message for an unexpected failure', async () => {
    const service = fakeService({ createHousehold: jest.fn().mockRejectedValue(new Error('x')) });
    await renderScreen({ service });

    typeInto('Household name', 'Home');
    fireEvent.press(screen.getByRole('button', { name: 'Create household' }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });

  it('clears an old error when the next attempt starts', async () => {
    const service = fakeService({
      joinHousehold: jest
        .fn()
        .mockRejectedValueOnce(new InviteRejectedError('invalid'))
        .mockResolvedValue(HOME),
    });
    await renderScreen({ service });
    typeInto('Invite code', 'ABCDEFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Join household' }));
    await screen.findByText(/That code is not valid/);
    fireEvent.press(screen.getByRole('button', { name: 'Join household' }));

    await waitFor(() => expect(screen.queryByText(/That code is not valid/)).toBeNull());
  });
});

describe('HouseholdScreen: joining with data already on the device', () => {
  async function renderWithLocalData() {
    const service = fakeService({
      joinHousehold: jest
        .fn()
        .mockRejectedValueOnce(new LocalDataDecisionRequired())
        .mockResolvedValue(HOME),
    });
    await renderScreen({ service });
    typeInto('Invite code', 'ABCDEFGH');
    typeInto('Your name (optional)', 'Sam');
    fireEvent.press(screen.getByRole('button', { name: 'Join household' }));
    await screen.findByText('This device already has data');
    return service;
  }

  it('asks what to do before retrying, without showing an error', async () => {
    await renderWithLocalData();

    expect(screen.getByText('Add my items to the household')).toBeTruthy();
    expect(screen.getByText("Discard mine, use the household's")).toBeTruthy();
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull();
  });

  it('retries with upload when the person keeps their items', async () => {
    const service = await renderWithLocalData();

    fireEvent.press(screen.getByRole('button', { name: /Add my items to the household/ }));

    await waitFor(() =>
      expect(service.joinHousehold).toHaveBeenLastCalledWith('ABCDEFGH', {
        displayName: 'Sam',
        localData: 'upload',
      }),
    );
  });

  it('retries with discard when the person takes the household copy', async () => {
    const service = await renderWithLocalData();

    fireEvent.press(screen.getByRole('button', { name: /Discard mine, use the household's/ }));

    await waitFor(() =>
      expect(service.joinHousehold).toHaveBeenLastCalledWith('ABCDEFGH', {
        displayName: 'Sam',
        localData: 'discard',
      }),
    );
  });

  it('can be cancelled without joining', async () => {
    const service = await renderWithLocalData();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('This device already has data')).toBeNull();
    expect(service.joinHousehold).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal after the choice and closes the question', async () => {
    const service = await renderWithLocalData();
    service.joinHousehold.mockRejectedValueOnce(new InviteRejectedError('full'));

    fireEvent.press(screen.getByRole('button', { name: /Add my items to the household/ }));

    expect(await screen.findByText('That household is full.')).toBeTruthy();
    expect(screen.queryByText('This device already has data')).toBeNull();
  });
});

describe('HouseholdScreen: membership lost', () => {
  it('explains it, keeps the sharing options available, and can be dismissed', async () => {
    const service = fakeService();
    await renderScreen({ membershipLost: true, service });

    expect(screen.getByText('You are no longer in the household')).toBeTruthy();
    expect(screen.getByText('Create a household')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));

    expect(service.dismissMembershipLost).toHaveBeenCalled();
  });

  it('is absent otherwise', async () => {
    await renderScreen();

    expect(screen.queryByText('You are no longer in the household')).toBeNull();
  });
});

describe('HouseholdScreen: in a household', () => {
  const inHome = (overrides: SharingValueOverrides = {}) => ({
    household: HOME,
    ...overrides,
  });

  it('shows the household and its members', async () => {
    const service = fakeService({ listMembers: jest.fn(async () => [ME, SAM]) });
    await renderScreen(inHome({ service }));

    expect(screen.getByText('Home')).toBeTruthy();
    expect(await screen.findByText('Alex')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    expect(screen.getByText('Joined 2 Oct')).toBeTruthy();
    expect(screen.queryByText('Create a household')).toBeNull();
  });

  it('lets the person retry when the members cannot be loaded', async () => {
    const listMembers = jest
      .fn()
      .mockRejectedValueOnce(new SharingError('offline', 'x'))
      .mockResolvedValue([ME]);
    await renderScreen(inHome({ service: fakeService({ listMembers }) }));

    expect(await screen.findByText('Could not load the members.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Alex')).toBeTruthy();
    expect(screen.queryByText('Could not load the members.')).toBeNull();
  });

  it('lists the active invite codes with their expiry', async () => {
    const service = fakeService({ listInvites: jest.fn(async () => [invite('ABCDEFGH')]) });
    await renderScreen(inHome({ service }));

    expect(await screen.findByText('ABCD-EFGH')).toBeTruthy();
    expect(screen.getByText('Expires 13 Oct, 18:30')).toBeTruthy();
  });

  it('says when there are no active codes', async () => {
    await renderScreen(inHome());

    expect(await screen.findByText('No active codes.')).toBeTruthy();
  });

  it('generates a code and shows it formatted, newest first', async () => {
    const service = fakeService({
      listInvites: jest.fn(async () => [invite('AAAAAAAA')]),
      createInvite: jest.fn(async () => invite('BBBBCCCC')),
    });
    await renderScreen(inHome({ service }));
    await screen.findByText('AAAA-AAAA');

    fireEvent.press(screen.getByRole('button', { name: 'Generate invite code' }));

    expect(await screen.findByText('BBBB-CCCC')).toBeTruthy();
    const codes = screen.getAllByTestId('invite-code').map((node) => node.props.children);
    expect(codes).toEqual(['BBBB-CCCC', 'AAAA-AAAA']);
  });

  it('shows why generating a code failed', async () => {
    const service = fakeService({
      createInvite: jest.fn().mockRejectedValue(new SharingError('offline', 'x')),
    });
    await renderScreen(inHome({ service }));

    fireEvent.press(screen.getByRole('button', { name: 'Generate invite code' }));

    expect(
      await screen.findByText('You are offline. Check your connection and try again.'),
    ).toBeTruthy();
  });

  it('shares a code through the system share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const service = fakeService({ listInvites: jest.fn(async () => [invite('ABCDEFGH')]) });
    await renderScreen(inHome({ service }));
    await screen.findByText('ABCD-EFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Share code ABCD-EFGH' }));

    expect(share).toHaveBeenCalledWith({
      message: 'Join my household on RecetApp with this code: ABCD-EFGH',
    });
    share.mockRestore();
  });

  it('survives the share sheet failing or being dismissed', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('nope'));
    const service = fakeService({ listInvites: jest.fn(async () => [invite('ABCDEFGH')]) });
    await renderScreen(inHome({ service }));
    await screen.findByText('ABCD-EFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Share code ABCD-EFGH' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.getByText('ABCD-EFGH')).toBeTruthy();
    share.mockRestore();
  });

  it('revokes a code and removes it from the list', async () => {
    const service = fakeService({
      listInvites: jest.fn(async () => [invite('ABCDEFGH', 'i1'), invite('JKMNPQRS', 'i2')]),
    });
    await renderScreen(inHome({ service }));
    await screen.findByText('ABCD-EFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Revoke code ABCD-EFGH' }));

    await waitFor(() => expect(service.revokeInvite).toHaveBeenCalledWith('i1'));
    await waitFor(() => expect(screen.queryByText('ABCD-EFGH')).toBeNull());
    expect(screen.getByText('JKMN-PQRS')).toBeTruthy();
  });

  it('keeps the code listed when revoking fails', async () => {
    const service = fakeService({
      listInvites: jest.fn(async () => [invite('ABCDEFGH', 'i1')]),
      revokeInvite: jest.fn().mockRejectedValue(new SharingError('server', 'x')),
    });
    await renderScreen(inHome({ service }));
    await screen.findByText('ABCD-EFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Revoke code ABCD-EFGH' }));

    expect(await screen.findByText('The server had a problem. Try again later.')).toBeTruthy();
    expect(screen.getByText('ABCD-EFGH')).toBeTruthy();
  });

  it('shows when the invite codes cannot be loaded', async () => {
    const service = fakeService({
      listInvites: jest.fn().mockRejectedValue(new SharingError('offline', 'x')),
    });
    await renderScreen(inHome({ service }));

    expect(await screen.findByText('Could not load the invite codes.')).toBeTruthy();
  });
});

describe('HouseholdScreen: sync status', () => {
  it.each([
    ['synced', 'Synced'],
    ['syncing', 'Syncing…'],
    ['offline', 'Offline'],
    ['error', 'Sync problem'],
  ] as const)('shows the %s state', async (state, label) => {
    await renderScreen({ household: HOME, sync: { state } });

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('counts the changes waiting to be sent', async () => {
    await renderScreen({ household: HOME, sync: { state: 'offline', pending: 3 } });

    expect(screen.getByText('3 changes waiting')).toBeTruthy();
  });

  it('uses the singular for one change', async () => {
    await renderScreen({ household: HOME, sync: { state: 'offline', pending: 1 } });

    expect(screen.getByText('1 change waiting')).toBeTruthy();
  });

  it('shows the last successful sync, or that there is none yet', async () => {
    const synced = new Date(2026, 9, 12, 8, 5).toISOString();
    const view = await renderScreen({ household: HOME, sync: { lastSyncedAt: synced } });
    expect(screen.getByText('Last synced 12 Oct, 08:05')).toBeTruthy();

    view.update({ household: HOME, sync: { lastSyncedAt: null } });
    expect(screen.getByText('Not synced yet')).toBeTruthy();
  });

  it('explains why sync failed', async () => {
    await renderScreen({ household: HOME, sync: { state: 'error', error: 'server' } });

    expect(screen.getByText('The server had a problem. Try again later.')).toBeTruthy();
  });

  it('reports changes the server refused for good', async () => {
    await renderScreen({ household: HOME, sync: { rejected: 2 } });

    expect(screen.getByText('2 changes could not be saved.')).toBeTruthy();
  });
});

describe('HouseholdScreen: leaving', () => {
  const leaveFlow = async (service: FakeService) => {
    await renderScreen({ household: HOME, service });
    fireEvent.press(screen.getByRole('button', { name: 'Leave household' }));
  };

  it('asks before leaving and offers keep or delete of the local copy', async () => {
    const service = fakeService();
    await leaveFlow(service);

    expect(screen.getByText('Leave this household?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave and keep a copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave and delete my copy' })).toBeTruthy();
    expect(service.leaveHousehold).not.toHaveBeenCalled();
  });

  it('leaves and keeps the copy', async () => {
    const service = fakeService();
    await leaveFlow(service);

    fireEvent.press(screen.getByRole('button', { name: 'Leave and keep a copy' }));

    await waitFor(() => expect(service.leaveHousehold).toHaveBeenCalledWith({ localData: 'keep' }));
  });

  it('leaves and deletes the copy', async () => {
    const service = fakeService();
    await leaveFlow(service);

    fireEvent.press(screen.getByRole('button', { name: 'Leave and delete my copy' }));

    await waitFor(() =>
      expect(service.leaveHousehold).toHaveBeenCalledWith({ localData: 'discard' }),
    );
  });

  it('stays when the person changes their mind', async () => {
    const service = fakeService();
    await leaveFlow(service);

    fireEvent.press(screen.getByRole('button', { name: 'Stay' }));

    expect(screen.queryByText('Leave this household?')).toBeNull();
    expect(service.leaveHousehold).not.toHaveBeenCalled();
  });

  it('reports a failure to leave and stays in the household', async () => {
    const service = fakeService({
      leaveHousehold: jest.fn().mockRejectedValue(new SharingError('offline', 'x')),
    });
    await leaveFlow(service);

    fireEvent.press(screen.getByRole('button', { name: 'Leave and keep a copy' }));

    expect(
      await screen.findByText('You are offline. Check your connection and try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('switches to the sharing options once the household is gone', async () => {
    const view = await renderScreen({ household: HOME });

    view.update({ household: null });

    expect(screen.getByText('Create a household')).toBeTruthy();
  });
});

describe('HouseholdScreen in Spanish', () => {
  it('translates the sharing options and the code validation', async () => {
    await renderScreen({}, 'es');

    expect(screen.getByText('Crear un hogar')).toBeTruthy();
    expect(screen.getByText('Unirse con un código')).toBeTruthy();
    typeInto('Código de invitación', 'abc');
    expect(screen.getByText('Escribe los 8 caracteres del código.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unirse al hogar' })).toBeTruthy();
  });

  it('translates the household, the invites and the sync status', async () => {
    const service = fakeService({
      listMembers: jest.fn(async () => [ME, SAM]),
      listInvites: jest.fn(async () => [invite('ABCDEFGH')]),
    });
    await renderScreen({ household: HOME, service, sync: { state: 'offline', pending: 2 } }, 'es');

    expect(await screen.findByText('Miembros')).toBeTruthy();
    expect(screen.getByText('Sin conexión')).toBeTruthy();
    expect(screen.getByText('2 cambios en espera')).toBeTruthy();
    expect(await screen.findByText('Vence el 13 oct, 18:30')).toBeTruthy();
    expect(screen.getByText('Se unió el 2 oct')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compartir el código ABCD-EFGH' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revocar el código ABCD-EFGH' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salir del hogar' })).toBeTruthy();
  });

  it('translates a refused code and the local-data question', async () => {
    const service = fakeService({
      joinHousehold: jest
        .fn()
        .mockRejectedValueOnce(new LocalDataDecisionRequired())
        .mockRejectedValueOnce(new InviteRejectedError('invalid')),
    });
    await renderScreen({ service }, 'es');
    typeInto('Código de invitación', 'ABCDEFGH');

    fireEvent.press(screen.getByRole('button', { name: 'Unirse al hogar' }));
    expect(await screen.findByText('Este dispositivo ya tiene datos')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /Agregar mis productos al hogar/ }));
    expect(
      await screen.findByText('Ese código no es válido. Puede haber vencido o ya se usó.'),
    ).toBeTruthy();
  });

  it('translates the leave confirmation', async () => {
    await renderScreen({ household: HOME }, 'es');

    fireEvent.press(screen.getByRole('button', { name: 'Salir del hogar' }));

    expect(screen.getByText('¿Salir de este hogar?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salir y conservar una copia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salir y borrar mi copia' })).toBeTruthy();
  });

  it('translates the membership-lost notice', async () => {
    await renderScreen({ membershipLost: true }, 'es');

    expect(screen.getByText('Ya no estás en el hogar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
  });
});
