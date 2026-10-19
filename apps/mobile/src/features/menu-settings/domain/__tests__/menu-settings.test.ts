import {
  DEFAULT_MENU_SETTINGS,
  parseMenuSettings,
  periodWeeks,
  toggleMealSlot,
} from '../menu-settings';

describe('DEFAULT_MENU_SETTINGS', () => {
  it('plans a week of all three meals, without repeats, for Colombia', () => {
    expect(DEFAULT_MENU_SETTINGS).toEqual({
      period: 'weekly',
      allowRepeats: false,
      includeIngredients: false,
      slots: ['breakfast', 'lunch', 'dinner'],
      region: 'CO',
    });
  });
});

describe('parseMenuSettings', () => {
  it('falls back to the defaults for anything that is not an object', () => {
    expect(parseMenuSettings(null)).toEqual(DEFAULT_MENU_SETTINGS);
    expect(parseMenuSettings('nope')).toEqual(DEFAULT_MENU_SETTINGS);
    expect(parseMenuSettings(42)).toEqual(DEFAULT_MENU_SETTINGS);
  });

  it('keeps valid stored values', () => {
    expect(
      parseMenuSettings({
        period: 'biweekly',
        allowRepeats: true,
        includeIngredients: true,
        slots: ['dinner', 'lunch'],
        region: 'CO',
      }),
    ).toEqual({
      period: 'biweekly',
      allowRepeats: true,
      includeIngredients: true,
      slots: ['lunch', 'dinner'],
      region: 'CO',
    });
  });

  it('replaces each unknown or mistyped field with its default', () => {
    expect(
      parseMenuSettings({
        period: 'monthly',
        allowRepeats: 'yes',
        includeIngredients: 1,
        slots: 'dinner',
        region: 'ZZ',
      }),
    ).toEqual(DEFAULT_MENU_SETTINGS);
  });

  it('fills in what an older build never stored', () => {
    expect(parseMenuSettings({ period: 'biweekly' })).toEqual({
      ...DEFAULT_MENU_SETTINGS,
      period: 'biweekly',
    });
  });

  it('drops unknown meals and duplicates, and never leaves the plan with no meals', () => {
    expect(parseMenuSettings({ slots: ['brunch', 'dinner', 'dinner'] }).slots).toEqual(['dinner']);
    expect(parseMenuSettings({ slots: [] }).slots).toEqual(DEFAULT_MENU_SETTINGS.slots);
    expect(parseMenuSettings({ slots: ['brunch'] }).slots).toEqual(DEFAULT_MENU_SETTINGS.slots);
  });
});

describe('periodWeeks', () => {
  it('counts the weeks in each period', () => {
    expect(periodWeeks('weekly')).toBe(1);
    expect(periodWeeks('biweekly')).toBe(2);
  });
});

describe('toggleMealSlot', () => {
  it('adds a meal in day order', () => {
    expect(toggleMealSlot(['dinner'], 'breakfast')).toEqual(['breakfast', 'dinner']);
  });

  it('removes a meal', () => {
    expect(toggleMealSlot(['breakfast', 'dinner'], 'breakfast')).toEqual(['dinner']);
  });

  it('never removes the last meal', () => {
    expect(toggleMealSlot(['dinner'], 'dinner')).toEqual(['dinner']);
  });
});
