import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { startOfWeek, type MealPlanEntryDto } from '@recetapp/contracts';

import ShoppingScreen from '@/app/(tabs)/shopping';
import { SharingTestProvider, sharingValue } from '@/features/household/testing/fake-sharing';
import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';

import { InMemoryShoppingChecksRepository } from '../../infrastructure/in-memory-shopping-checks-repository';

const mockPlan = { current: new InMemoryMealPlanRepository() };
const mockChecks = { current: new InMemoryShoppingChecksRepository() };

jest.mock('@/features/meal-plan/infrastructure/create-meal-plan-repository', () => ({
  createMealPlanRepository: jest.fn(async () => mockPlan.current),
}));
jest.mock('../../infrastructure/create-shopping-checks-repository', () => ({
  createShoppingChecksRepository: jest.fn(async () => mockChecks.current),
}));
jest.mock('@/shared/settings/create-settings-repository', () => {
  const { InMemorySettingsRepository } = jest.requireActual(
    '@/shared/settings/in-memory-settings-repository',
  );
  return { createSettingsRepository: jest.fn(async () => new InMemorySettingsRepository()) };
});
jest.mock('../../infrastructure/expo-notification-scheduler', () => ({
  createNotificationScheduler: () => ({ scheduleLowStockReminder: jest.fn(async () => undefined) }),
}));
jest.mock('@/features/pantry/ui/pantry-provider', () => ({
  usePantry: () => ({ entries: [], loading: false }),
}));
jest.mock('@/features/preferences/ui/preferences-provider', () => ({
  usePreferences: () => ({
    preferences: jest.requireActual('@/features/preferences/domain/preferences')
      .DEFAULT_PREFERENCES,
  }),
}));

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function planEntry(
  dishTitle: string,
  ingredient: string,
  slot: 'lunch' | 'dinner',
): MealPlanEntryDto {
  return {
    date: startOfWeek(todayIsoDate()),
    slot,
    dishId: dishTitle.toLowerCase().replace(/\s+/g, '-'),
    dishTitle,
    summary: '',
    ingredients: [ingredient],
  };
}

function tree(revision: number) {
  return (
    <SharingTestProvider value={sharingValue({ sync: { remoteRevision: revision } })}>
      <ShoppingScreen />
    </SharingTestProvider>
  );
}

describe('ShoppingScreen and the household', () => {
  beforeEach(() => {
    mockPlan.current = new InMemoryMealPlanRepository();
    mockChecks.current = new InMemoryShoppingChecksRepository();
  });

  it('stores ticks through the shared checks repository', async () => {
    await mockPlan.current.upsertMany([planEntry('Pasta night', 'pasta', 'dinner')]);
    render(tree(0));

    fireEvent.press(await screen.findByRole('checkbox', { name: 'Tick off pasta' }));

    await waitFor(async () =>
      expect(await mockChecks.current.findAll()).toEqual([{ key: 'pasta', name: 'pasta' }]),
    );
    expect(screen.getByRole('checkbox', { name: 'Untick pasta' })).toBeTruthy();
  });

  it('shows ticks that were already stored', async () => {
    await mockPlan.current.upsertMany([planEntry('Pasta night', 'pasta', 'dinner')]);
    await mockChecks.current.check({ key: 'pasta', name: 'pasta' });

    render(tree(0));

    expect(await screen.findByRole('checkbox', { name: 'Untick pasta' })).toBeTruthy();
  });

  it('reloads the menu and the ticks when household changes land', async () => {
    await mockPlan.current.upsertMany([planEntry('Pasta night', 'pasta', 'dinner')]);
    const view = render(tree(0));
    await screen.findByRole('checkbox', { name: 'Tick off pasta' });

    // What another phone did, as the sync engine writes it locally.
    await mockPlan.current.upsertMany([planEntry('Rice bowl', 'rice', 'lunch')]);
    await mockChecks.current.check({ key: 'pasta', name: 'pasta' });
    expect(screen.queryByRole('checkbox', { name: 'Tick off rice' })).toBeNull();
    await act(async () => view.rerender(tree(1)));

    expect(await screen.findByRole('checkbox', { name: 'Tick off rice' })).toBeTruthy();
    expect(await screen.findByRole('checkbox', { name: 'Untick pasta' })).toBeTruthy();
  });
});
