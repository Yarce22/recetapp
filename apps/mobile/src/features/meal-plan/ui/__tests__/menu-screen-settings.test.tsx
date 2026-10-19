import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { startOfWeek, weekStarts, type MealPlanEntryDto } from '@recetapp/contracts';

import MenuScreen from '@/app/(tabs)/menu';
import {
  DEFAULT_MENU_SETTINGS,
  type MenuSettings,
} from '@/features/menu-settings/domain/menu-settings';
import { SharingTestProvider, sharingValue } from '@/features/household/testing/fake-sharing';
import type { MealPlanRequestInput } from '@/features/recipes/domain/recipe-suggestion-service';

import { InMemoryMealPlanRepository } from '../../infrastructure/in-memory-meal-plan-repository';

const mockPlan = { current: new InMemoryMealPlanRepository() };
const mockSettings = { current: DEFAULT_MENU_SETTINGS as MenuSettings };
const mockUpdate = jest.fn(async () => {});
const mockPlanCalls: MealPlanRequestInput[] = [];

jest.mock('../../infrastructure/create-meal-plan-repository', () => ({
  createMealPlanRepository: jest.fn(async () => mockPlan.current),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/pantry/ui/pantry-provider', () => ({
  usePantry: () => ({ entries: [{}], loading: false }),
}));
jest.mock('@/features/preferences/ui/preferences-provider', () => ({
  usePreferences: () => ({
    preferences: jest.requireActual('@/features/preferences/domain/preferences')
      .DEFAULT_PREFERENCES,
    deviceId: 'device-a',
  }),
}));
jest.mock('@/features/menu-settings/ui/menu-settings-provider', () => ({
  useMenuSettings: () => ({
    settings: mockSettings.current,
    ready: true,
    update: mockUpdate,
  }),
}));
jest.mock('@/features/recipes/infrastructure/http-recipe-suggestion-service', () => ({
  createHttpRecipeSuggestionService: () => ({
    planWeek: async (input: MealPlanRequestInput) => {
      mockPlanCalls.push(input);
      return { entries: [], unfilled: [] };
    },
  }),
}));

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dinner(date: string, dishTitle: string): MealPlanEntryDto {
  return {
    date,
    slot: 'dinner',
    dishId: dishTitle.toLowerCase().replace(/\s+/g, '-'),
    dishTitle,
    summary: '',
    ingredients: [],
  };
}

const tree = () => (
  <SharingTestProvider value={sharingValue()}>
    <MenuScreen />
  </SharingTestProvider>
);

async function renderMenu() {
  render(tree());
  await act(async () => {});
}

describe('MenuScreen settings', () => {
  beforeEach(() => {
    mockPlan.current = new InMemoryMealPlanRepository();
    mockSettings.current = DEFAULT_MENU_SETTINGS;
    mockPlanCalls.length = 0;
    mockUpdate.mockClear();
  });

  it('plans one week of all three meals by default', async () => {
    await renderMenu();

    expect(screen.queryByText('Week 2')).toBeNull();

    await act(async () => fireEvent.press(screen.getByText('Plan my week')));

    expect(mockPlanCalls).toHaveLength(1);
    expect(mockPlanCalls[0].slots).toHaveLength(21);
    expect(new Set(mockPlanCalls[0].slots.map((slot) => slot.slot))).toEqual(
      new Set(['breakfast', 'lunch', 'dinner']),
    );
    expect(mockPlanCalls[0]).toMatchObject({
      region: 'CO',
      allowRepeats: false,
      includeIngredients: false,
    });
  });

  it('plans and shows both weeks when the period is biweekly', async () => {
    mockSettings.current = { ...DEFAULT_MENU_SETTINGS, period: 'biweekly' };
    const [, second] = weekStarts(todayIsoDate(), 2);
    await mockPlan.current.upsertMany([dinner(second, 'Second week stew')]);

    await renderMenu();

    expect(screen.getByText('Week 1')).toBeTruthy();
    expect(screen.getByText('Week 2')).toBeTruthy();
    expect(await screen.findByText('Second week stew')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Plan my week')));

    const dates = new Set(mockPlanCalls[0].slots.map((slot) => slot.date));
    expect(mockPlanCalls[0].slots).toHaveLength(42);
    expect(dates.size).toBe(14);
    expect(dates.has(startOfWeek(second))).toBe(true);
  });

  it('plans only the chosen meals and forwards the other settings', async () => {
    mockSettings.current = {
      ...DEFAULT_MENU_SETTINGS,
      slots: ['dinner'],
      allowRepeats: true,
      includeIngredients: true,
    };
    await renderMenu();

    await act(async () => fireEvent.press(screen.getByText('Plan my week')));

    expect(mockPlanCalls[0].slots).toHaveLength(7);
    expect(mockPlanCalls[0]).toMatchObject({ allowRepeats: true, includeIngredients: true });
  });

  it('opens the settings panel and saves a change', async () => {
    await renderMenu();
    expect(screen.queryByLabelText('Allow repeated dishes')).toBeNull();

    fireEvent.press(screen.getByLabelText('Menu settings'));
    fireEvent.press(screen.getByLabelText('Allow repeated dishes'));

    expect(mockUpdate).toHaveBeenCalledWith({ ...DEFAULT_MENU_SETTINGS, allowRepeats: true });

    fireEvent.press(screen.getByLabelText('Close menu settings'));
    expect(screen.queryByLabelText('Allow repeated dishes')).toBeNull();
  });
});
