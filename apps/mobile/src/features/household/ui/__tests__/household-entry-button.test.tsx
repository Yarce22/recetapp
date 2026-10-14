import { fireEvent, render, screen } from '@testing-library/react-native';

import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

import {
  HOME,
  SharingTestProvider,
  sharingValue,
  type SharingValueOverrides,
} from '../../testing/fake-sharing';
import { HouseholdEntryButton } from '../household-entry-button';

function renderButton(overrides: SharingValueOverrides = {}, onPress = jest.fn()) {
  render(
    <SharingTestProvider value={sharingValue(overrides)}>
      <HouseholdEntryButton onPress={onPress} />
    </SharingTestProvider>,
  );
  return { onPress };
}

describe('HouseholdEntryButton', () => {
  it('is hidden when sharing is not available', () => {
    renderButton({ available: false, service: null });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is hidden when there is no provider at all (solo, web)', () => {
    render(<HouseholdEntryButton onPress={jest.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invites to share when sharing is available but the device is solo', () => {
    const { onPress } = renderButton();

    fireEvent.press(screen.getByRole('button', { name: 'Share with a household' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('names the household and its sync state for a screen reader', () => {
    renderButton({ household: HOME, sync: { state: 'synced' } });

    expect(screen.getByRole('button', { name: 'Household Home, Synced' })).toBeTruthy();
  });

  it('includes how many changes are waiting', () => {
    renderButton({ household: HOME, sync: { state: 'offline', pending: 2 } });

    expect(
      screen.getByRole('button', { name: 'Household Home, Offline, 2 changes waiting' }),
    ).toBeTruthy();
  });

  it('speaks Spanish', async () => {
    await renderInLanguage(
      <SharingTestProvider
        value={sharingValue({ household: HOME, sync: { state: 'error', pending: 1 } })}
      >
        <HouseholdEntryButton onPress={jest.fn()} />
      </SharingTestProvider>,
      'es',
    );

    expect(
      screen.getByRole('button', {
        name: 'Hogar Home, Problema de sincronización, 1 cambio en espera',
      }),
    ).toBeTruthy();
  });
});
