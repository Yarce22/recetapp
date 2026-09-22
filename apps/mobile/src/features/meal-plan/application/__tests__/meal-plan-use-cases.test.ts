import type { MealPlanEntryDto } from '@recetapp/contracts';

import { makeClearSlot } from '@/features/meal-plan/application/clear-slot';
import { makeGenerateWeek } from '@/features/meal-plan/application/generate-week';
import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { makeRegenerateDay } from '@/features/meal-plan/application/regenerate-day';
import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';
import { DEFAULT_PREFERENCES } from '@/features/preferences/domain/preferences';
import type {
  MealPlanRequestInput,
  MealPlanResult,
  RecipeSuggestionService,
} from '@/features/recipes/domain/recipe-suggestion-service';

const WEEK = '2026-09-21';

const entry = (date: string, title: string): MealPlanEntryDto => ({
  date,
  slot: 'dinner',
  dishId: title.toLowerCase().replace(/\s+/g, '-'),
  dishTitle: title,
  summary: `A dish called ${title}`,
});

function fakeService(reply: (input: MealPlanRequestInput) => MealPlanResult) {
  const calls: MealPlanRequestInput[] = [];
  const service = {
    suggest: async () => {
      throw new Error('not used here');
    },
    recipe: async () => {
      throw new Error('not used here');
    },
    planWeek: async (input: MealPlanRequestInput) => {
      calls.push(input);
      return reply(input);
    },
  } as unknown as RecipeSuggestionService;

  return { service, calls };
}

function setup(reply: (input: MealPlanRequestInput) => MealPlanResult) {
  const repository = new InMemoryMealPlanRepository();
  const { service, calls } = fakeService(reply);

  return {
    repository,
    calls,
    getWeek: makeGetWeek(repository),
    clearSlot: makeClearSlot(repository),
    generateWeek: makeGenerateWeek(repository, service),
    regenerateDay: makeRegenerateDay(repository, service),
  };
}

const base = {
  weekStartDate: WEEK,
  pantry: [],
  preferences: DEFAULT_PREFERENCES,
};

describe('generateWeek', () => {
  it('stores what the server returned', async () => {
    const { generateWeek, getWeek } = setup(() => ({
      entries: [entry('2026-09-21', 'Pasta'), entry('2026-09-22', 'Stew')],
      unfilled: [],
    }));

    await generateWeek({
      ...base,
      slots: [
        { date: '2026-09-21', slot: 'dinner' },
        { date: '2026-09-22', slot: 'dinner' },
      ],
    });

    const week = await getWeek(WEEK);
    expect(week.map((e) => e.dishTitle)).toEqual(['Pasta', 'Stew']);
  });

  it('passes no exclusions, because the whole week is being replaced', async () => {
    const { generateWeek, calls } = setup(() => ({ entries: [], unfilled: [] }));

    await generateWeek({ ...base, slots: [{ date: '2026-09-21', slot: 'dinner' }] });

    expect(calls[0].exclude).toEqual([]);
  });

  it('hands back the slots the server could not fill', async () => {
    const { generateWeek } = setup(() => ({
      entries: [],
      unfilled: [{ date: '2026-09-21', slot: 'dinner' }],
    }));

    const result = await generateWeek({
      ...base,
      slots: [{ date: '2026-09-21', slot: 'dinner' }],
    });

    expect(result.unfilled).toHaveLength(1);
  });
});

describe('regenerateDay', () => {
  it('excludes the dishes already planned on the other days', async () => {
    const { repository, regenerateDay, calls } = setup(() => ({
      entries: [entry('2026-09-22', 'Omelette')],
      unfilled: [],
    }));

    await repository.upsertMany([
      entry('2026-09-21', 'Pasta'),
      entry('2026-09-22', 'Stew'),
      entry('2026-09-23', 'Curry'),
    ]);

    await regenerateDay({ ...base, date: '2026-09-22', slots: ['dinner'] });

    // Tuesday's own dish is not excluded - it is the one being replaced.
    expect([...calls[0].exclude].sort()).toEqual(['Curry', 'Pasta']);
  });

  it('replaces only that day, leaving the rest of the week alone', async () => {
    const { repository, regenerateDay, getWeek } = setup(() => ({
      entries: [entry('2026-09-22', 'Omelette')],
      unfilled: [],
    }));

    await repository.upsertMany([entry('2026-09-21', 'Pasta'), entry('2026-09-22', 'Stew')]);

    await regenerateDay({ ...base, date: '2026-09-22', slots: ['dinner'] });

    const week = await getWeek(WEEK);
    expect(week.map((e) => e.dishTitle)).toEqual(['Pasta', 'Omelette']);
  });

  it('asks only for the slots of that day', async () => {
    const { regenerateDay, calls } = setup(() => ({ entries: [], unfilled: [] }));

    await regenerateDay({ ...base, date: '2026-09-23', slots: ['lunch', 'dinner'] });

    expect(calls[0].slots).toEqual([
      { date: '2026-09-23', slot: 'lunch' },
      { date: '2026-09-23', slot: 'dinner' },
    ]);
  });

  it('clears a slot the server could not refill, rather than leaving the old dish', async () => {
    const { repository, regenerateDay, getWeek } = setup(() => ({
      entries: [],
      unfilled: [{ date: '2026-09-22', slot: 'dinner' }],
    }));

    await repository.upsertMany([entry('2026-09-22', 'Stew')]);

    await regenerateDay({ ...base, date: '2026-09-22', slots: ['dinner'] });

    expect(await getWeek(WEEK)).toEqual([]);
  });
});

describe('clearSlot', () => {
  it('removes just that meal', async () => {
    const { repository, clearSlot, getWeek } = setup(() => ({ entries: [], unfilled: [] }));

    await repository.upsertMany([entry('2026-09-21', 'Pasta'), entry('2026-09-22', 'Stew')]);
    await clearSlot({ date: '2026-09-21', slot: 'dinner' });

    const week = await getWeek(WEEK);
    expect(week.map((e) => e.dishTitle)).toEqual(['Stew']);
  });
});

describe('getWeek', () => {
  it('returns only the entries inside that week', async () => {
    const { repository, getWeek } = setup(() => ({ entries: [], unfilled: [] }));

    await repository.upsertMany([
      entry('2026-09-21', 'Pasta'),
      // The Monday after: a different week.
      entry('2026-09-28', 'Next week stew'),
    ]);

    const week = await getWeek(WEEK);
    expect(week.map((e) => e.dishTitle)).toEqual(['Pasta']);
  });

  it('accepts any day of the week and answers for the whole week', async () => {
    const { repository, getWeek } = setup(() => ({ entries: [], unfilled: [] }));

    await repository.upsertMany([entry('2026-09-21', 'Pasta')]);

    expect(await getWeek('2026-09-24')).toHaveLength(1);
  });
});
