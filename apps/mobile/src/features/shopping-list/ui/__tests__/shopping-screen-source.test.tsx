import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { startOfWeek } from '@recetapp/contracts';

import ShoppingScreen from '@/app/(tabs)/shopping';
import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';
import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { SHOPPING_SOURCE_SETTING_KEY } from '@/features/shopping-list/domain/shopping-source';
import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

import { InMemoryShoppingChecksRepository } from '../../infrastructure/in-memory-shopping-checks-repository';

const mockPlan = { current: new InMemoryMealPlanRepository() };
const mockChecks = { current: new InMemoryShoppingChecksRepository() };
const mockSettings = { current: new InMemorySettingsRepository() };
const mockPantry = { current: [] as PantryEntry[] };

jest.mock('@/features/meal-plan/infrastructure/create-meal-plan-repository', () => ({
  createMealPlanRepository: jest.fn(async () => mockPlan.current),
}));
jest.mock('../../infrastructure/create-shopping-checks-repository', () => ({
  createShoppingChecksRepository: jest.fn(async () => mockChecks.current),
}));
jest.mock('@/shared/settings/create-settings-repository', () => ({
  createSettingsRepository: jest.fn(async () => mockSettings.current),
}));
jest.mock('../../infrastructure/expo-notification-scheduler', () => ({
  createNotificationScheduler: () => ({ scheduleLowStockReminder: jest.fn(async () => undefined) }),
}));
jest.mock('@/features/pantry/ui/pantry-provider', () => ({
  usePantry: () => ({ entries: mockPantry.current, loading: false }),
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

function flourRunningLow(): PantryEntry {
  return {
    ingredient: createIngredient({
      id: 'flour',
      name: 'Flour',
      category: 'grain',
      defaultUnit: 'g',
    }),
    item: createPantryItem({
      ingredientId: 'flour',
      quantity: makeQuantity(10, 'g'),
      lowStockThreshold: makeQuantity(500, 'g'),
    }),
  };
}

describe('ShoppingScreen source', () => {
  beforeEach(async () => {
    mockPlan.current = new InMemoryMealPlanRepository();
    mockChecks.current = new InMemoryShoppingChecksRepository();
    mockSettings.current = new InMemorySettingsRepository();
    mockPantry.current = [flourRunningLow()];
    await mockPlan.current.upsertMany([
      {
        date: startOfWeek(todayIsoDate()),
        slot: 'dinner',
        dishId: 'pasta-night',
        dishTitle: 'Pasta night',
        summary: '',
        ingredients: ['pasta'],
      },
    ]);
  });

  it('is based on the weekly menu by default', async () => {
    render(<ShoppingScreen />);

    expect(await screen.findByRole('checkbox', { name: 'Tick off pasta' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Tick off Flour' })).toBeNull();
  });

  it('switches to the pantry items that are running low', async () => {
    render(<ShoppingScreen />);
    await screen.findByRole('checkbox', { name: 'Tick off pasta' });

    fireEvent.press(screen.getByRole('radio', { name: 'Running low' }));

    expect(await screen.findByRole('checkbox', { name: 'Tick off Flour' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Tick off pasta' })).toBeNull();
  });

  it('remembers the choice', async () => {
    render(<ShoppingScreen />);
    await screen.findByRole('checkbox', { name: 'Tick off pasta' });

    fireEvent.press(screen.getByRole('radio', { name: 'Running low' }));

    await waitFor(async () =>
      expect(await mockSettings.current.get(SHOPPING_SOURCE_SETTING_KEY)).toBe('low-stock'),
    );
  });

  it('opens on the stored choice', async () => {
    await mockSettings.current.set(SHOPPING_SOURCE_SETTING_KEY, 'low-stock');

    render(<ShoppingScreen />);

    expect(await screen.findByRole('checkbox', { name: 'Tick off Flour' })).toBeTruthy();
  });
});
