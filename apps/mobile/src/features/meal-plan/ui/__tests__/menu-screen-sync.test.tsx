import { act, render, screen } from '@testing-library/react-native';

import { startOfWeek, type MealPlanEntryDto } from '@recetapp/contracts';

import MenuScreen from '@/app/(tabs)/menu';
import { SharingTestProvider, sharingValue } from '@/features/household/testing/fake-sharing';

import { InMemoryMealPlanRepository } from '../../infrastructure/in-memory-meal-plan-repository';

const mockPlan = { current: new InMemoryMealPlanRepository() };

jest.mock('../../infrastructure/create-meal-plan-repository', () => ({
  createMealPlanRepository: jest.fn(async () => mockPlan.current),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/pantry/ui/pantry-provider', () => ({
  usePantry: () => ({ entries: [], loading: false }),
}));
jest.mock('@/features/preferences/ui/preferences-provider', () => ({
  usePreferences: () => ({
    preferences: jest.requireActual('@/features/preferences/domain/preferences')
      .DEFAULT_PREFERENCES,
    deviceId: null,
  }),
}));

jest.mock('@/features/menu-settings/ui/menu-settings-provider', () => ({
  useMenuSettings: () => ({
    settings: jest.requireActual('@/features/menu-settings/domain/menu-settings')
      .DEFAULT_MENU_SETTINGS,
    ready: true,
    update: jest.fn(),
  }),
}));

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dinner(dishTitle: string): MealPlanEntryDto {
  return {
    date: startOfWeek(todayIsoDate()),
    slot: 'dinner',
    dishId: dishTitle.toLowerCase().replace(/\s+/g, '-'),
    dishTitle,
    summary: '',
    ingredients: [],
  };
}

function tree(revision: number) {
  return (
    <SharingTestProvider value={sharingValue({ sync: { remoteRevision: revision } })}>
      <MenuScreen />
    </SharingTestProvider>
  );
}

describe('MenuScreen and the household', () => {
  beforeEach(() => {
    mockPlan.current = new InMemoryMealPlanRepository();
  });

  it('shows the local menu', async () => {
    await mockPlan.current.upsertMany([dinner('Pasta night')]);

    render(tree(0));

    expect(await screen.findByText('Pasta night')).toBeTruthy();
  });

  it('reloads the week when household changes land in the local plan', async () => {
    const view = render(tree(0));
    await act(async () => {});

    await mockPlan.current.upsertMany([dinner('Rice bowl')]);
    expect(screen.queryByText('Rice bowl')).toBeNull();
    await act(async () => view.rerender(tree(1)));

    expect(await screen.findByText('Rice bowl')).toBeTruthy();
  });

  it('keeps the week as it is while nothing changes underneath', async () => {
    const view = render(tree(3));
    await act(async () => {});

    await mockPlan.current.upsertMany([dinner('Rice bowl')]);
    await act(async () => view.rerender(tree(3)));

    expect(screen.queryByText('Rice bowl')).toBeNull();
  });
});
