import { buildMealPlan, startOfWeek, weekDates, weekStarts } from '../meal-plan-rules.ts';
import type { PreferencesDto, RawDishSuggestion } from '../types.ts';

const preferences = (overrides: Partial<PreferencesDto> = {}): PreferencesDto => ({
  suggestionMode: 'flexible',
  maxMissingIngredients: 3,
  staples: ['salt'],
  dietary: [],
  dislikes: [],
  ...overrides,
});

const dish = (title: string, ingredients: string[] = ['tomato']): RawDishSuggestion => ({
  title,
  summary: `A dish called ${title}`,
  ingredients: ingredients.map((name) => ({ name, optional: false })),
});

describe('startOfWeek', () => {
  it('returns the Monday of that week', () => {
    // 2026-09-22 is a Tuesday.
    expect(startOfWeek('2026-09-22')).toBe('2026-09-21');
  });

  it('leaves a Monday where it is', () => {
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
  });

  it('treats Sunday as the end of its week, not the start of the next', () => {
    // 2026-09-27 is a Sunday; its week began on the 21st.
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
  });

  it('crosses a month boundary without drifting', () => {
    // 2026-10-01 is a Thursday.
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28');
  });

  it('rejects something that is not a calendar date', () => {
    expect(() => startOfWeek('not-a-date')).toThrow();
    expect(() => startOfWeek('2026-13-01')).toThrow();
  });
});

describe('weekDates', () => {
  it('lists the seven days from Monday', () => {
    expect(weekDates('2026-09-21')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('starts from the Monday even when handed a midweek date', () => {
    expect(weekDates('2026-09-24')[0]).toBe('2026-09-21');
  });
});

describe('buildMealPlan', () => {
  const slots = [
    { date: '2026-09-21', slot: 'dinner' as const },
    { date: '2026-09-22', slot: 'dinner' as const },
    { date: '2026-09-23', slot: 'dinner' as const },
  ];

  it('fills each requested slot with a different dish', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta'), dish('Stew'), dish('Omelette')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries).toHaveLength(3);
    expect(result.unfilled).toHaveLength(0);
    expect(new Set(result.entries.map((e) => e.dishTitle)).size).toBe(3);
  });

  it('never repeats a dish inside the plan, even if the model proposed it twice', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta'), dish('pasta'), dish('Stew')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries.map((e) => e.dishTitle)).toEqual(['Pasta', 'Stew']);
    expect(result.unfilled).toEqual([{ date: '2026-09-23', slot: 'dinner' }]);
  });

  it('skips dishes already placed elsewhere in the week', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta'), dish('Stew'), dish('Omelette')],
      slots: [slots[0]],
      exclude: ['pasta', 'stew'],
      preferences: preferences(),
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].dishTitle).toBe('Omelette');
  });

  it('reports the slots it could not fill instead of padding with repeats', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries).toHaveLength(1);
    expect(result.unfilled).toEqual([
      { date: '2026-09-22', slot: 'dinner' },
      { date: '2026-09-23', slot: 'dinner' },
    ]);
  });

  it('does not limit the week to the pantry, even in strict mode', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta', ['pasta', 'basil']), dish('Tomato salad', ['tomato'])],
      slots: [slots[0], slots[1]],
      exclude: [],
      preferences: preferences({ suggestionMode: 'strict', maxMissingIngredients: 0 }),
    });

    expect(result.entries.map((e) => e.dishTitle)).toEqual(['Pasta', 'Tomato salad']);
  });

  it('lists every required ingredient on the entry, so the shopping list can subtract the pantry', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta', ['pasta', 'basil'])],
      slots: [slots[0]],
      exclude: [],
      preferences: preferences({ suggestionMode: 'strict' }),
    });

    expect(result.entries[0].ingredients).toEqual(['pasta', 'basil']);
  });

  it('refuses a dish with a disliked ingredient, exactly like the suggestions do', () => {
    const result = buildMealPlan({
      proposals: [dish('Satay', ['peanut']), dish('Stew', ['tomato'])],
      slots: [slots[0]],
      exclude: [],
      preferences: preferences({ dislikes: ['peanut'] }),
    });

    expect(result.entries.map((e) => e.dishTitle)).toEqual(['Stew']);
  });

  it('keeps the requested slot order, so Monday gets the first dish', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta'), dish('Stew')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries[0]).toMatchObject({ date: '2026-09-21', dishTitle: 'Pasta' });
    expect(result.entries[1]).toMatchObject({ date: '2026-09-22', dishTitle: 'Stew' });
  });

  it('gives each entry the same dish id the suggestions use', () => {
    const result = buildMealPlan({
      proposals: [dish('Tomato salad')],
      slots: [slots[0]],
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries[0].dishId).toBe('tomato-salad');
  });

  it('carries the ingredients, so the shopping list needs no extra model call', () => {
    const result = buildMealPlan({
      proposals: [dish('Pasta', ['tomato', 'pasta'])],
      slots: [slots[0]],
      exclude: [],
      preferences: preferences(),
    });

    expect([...result.entries[0].ingredients].sort()).toEqual(['pasta', 'tomato']);
  });

  it('returns nothing rather than guessing when the model proposed nothing usable', () => {
    const result = buildMealPlan({
      proposals: [],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(result.entries).toEqual([]);
    expect(result.unfilled).toHaveLength(3);
  });
});

describe('weekStarts', () => {
  it('lists consecutive Mondays from the week containing the date', () => {
    expect(weekStarts('2026-09-23', 1)).toEqual(['2026-09-21']);
    expect(weekStarts('2026-09-23', 2)).toEqual(['2026-09-21', '2026-09-28']);
  });

  it('crosses a month boundary', () => {
    expect(weekStarts('2026-09-28', 2)).toEqual(['2026-09-28', '2026-10-05']);
  });
});

describe('buildMealPlan with repeats allowed', () => {
  const slots = [
    { date: '2026-09-21', slot: 'dinner' as const },
    { date: '2026-09-22', slot: 'dinner' as const },
    { date: '2026-09-23', slot: 'dinner' as const },
  ];

  it('reuses dishes to fill every slot', () => {
    const { entries, unfilled } = buildMealPlan({
      proposals: [dish('Pasta'), dish('Stew')],
      slots,
      exclude: [],
      preferences: preferences(),
      allowRepeats: true,
    });

    expect(entries.map((e) => e.dishTitle)).toEqual(['Pasta', 'Stew', 'Pasta']);
    expect(unfilled).toEqual([]);
  });

  it('still reports unfilled slots when nothing survives the filters', () => {
    const { entries, unfilled } = buildMealPlan({
      proposals: [],
      slots,
      exclude: [],
      preferences: preferences(),
      allowRepeats: true,
    });

    expect(entries).toEqual([]);
    expect(unfilled).toHaveLength(3);
  });

  it('does not repeat by default', () => {
    const { entries, unfilled } = buildMealPlan({
      proposals: [dish('Pasta'), dish('Stew')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(entries).toHaveLength(2);
    expect(unfilled).toHaveLength(1);
  });
});

describe('buildMealPlan with ingredients included', () => {
  const withQuantities = (title: string): RawDishSuggestion => ({
    title,
    summary: 's',
    ingredients: [
      { name: 'tomato', optional: false, quantity: { amount: 200, unit: 'g' } },
      { name: 'salt', optional: true },
    ],
  });

  const slots = [{ date: '2026-09-21', slot: 'dinner' as const }];

  it('attaches the dish ingredients that came with a quantity', () => {
    const { entries } = buildMealPlan({
      proposals: [withQuantities('Pasta')],
      slots,
      exclude: [],
      preferences: preferences(),
      includeIngredients: true,
    });

    expect(entries[0].recipeIngredients).toEqual([
      { name: 'tomato', quantity: { amount: 200, unit: 'g' }, optional: false },
    ]);
  });

  it('leaves the field out when not asked for', () => {
    const { entries } = buildMealPlan({
      proposals: [withQuantities('Pasta')],
      slots,
      exclude: [],
      preferences: preferences(),
    });

    expect(entries[0]).not.toHaveProperty('recipeIngredients');
  });
});
