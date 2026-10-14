import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';
import { InMemoryPantryRepository } from '@/features/pantry/infrastructure/in-memory-pantry-repository';
import { InMemoryShoppingChecksRepository } from '@/features/shopping-list/infrastructure/in-memory-shopping-checks-repository';

import { pantryEntry } from '../../testing/device';
import {
  createMealPlanEntityStore,
  createPantryEntityStore,
  createShoppingEntityStore,
} from '../entity-stores';

describe('pantry entity store', () => {
  it('round-trips a pantry entry through its wire row', async () => {
    const source = new InMemoryPantryRepository();
    await source.save(pantryEntry('Milk', 3));
    const [row] = await createPantryEntityStore(source).readAll();

    const target = new InMemoryPantryRepository();
    await createPantryEntityStore(target).upsert(row);

    expect((await target.findAll())[0]).toEqual(pantryEntry('Milk', 3));
  });

  it('refuses a row that violates a domain invariant instead of storing it', async () => {
    const store = createPantryEntityStore(new InMemoryPantryRepository());

    await expect(
      store.upsert({
        ingredient_id: 'milk',
        display_name: '   ',
        category: 'dairy',
        default_unit: 'ml',
        amount: 1,
        unit: 'ml',
      }),
    ).rejects.toThrow();
    await expect(store.upsert({ ingredient_id: 'milk', amount: 'lots' })).rejects.toThrow();
  });

  it('removes by key and clears everything', async () => {
    const repo = new InMemoryPantryRepository();
    await repo.save(pantryEntry('Milk'));
    await repo.save(pantryEntry('Eggs'));
    const store = createPantryEntityStore(repo);

    await store.remove('["milk"]');
    expect((await repo.findAll()).map((e) => e.ingredient.id)).toEqual(['eggs']);

    await store.clear();
    expect(await repo.findAll()).toEqual([]);
  });
});

describe('meal plan entity store', () => {
  const row = {
    date: '2026-10-12',
    slot: 'dinner',
    dish_id: 'd1',
    dish_title: 'Soup',
    summary: 's',
    ingredients: ['rice', 'water'],
  };

  it('applies and reads back a plan entry', async () => {
    const repo = new InMemoryMealPlanRepository();
    const store = createMealPlanEntityStore(repo);

    await store.upsert(row);

    expect(await store.readAll()).toEqual([row]);
  });

  it('rejects an unknown slot and a malformed ingredient list', async () => {
    const store = createMealPlanEntityStore(new InMemoryMealPlanRepository());

    await expect(store.upsert({ ...row, slot: 'brunch' })).rejects.toThrow();
    await expect(store.upsert({ ...row, ingredients: 'rice' })).rejects.toThrow();
  });

  it('removes by date and slot', async () => {
    const repo = new InMemoryMealPlanRepository();
    const store = createMealPlanEntityStore(repo);
    await store.upsert(row);

    await store.remove('["2026-10-12","dinner"]');

    expect(await repo.findAll()).toEqual([]);
  });
});

describe('shopping entity store', () => {
  it('applies, reads and removes ticks', async () => {
    const repo = new InMemoryShoppingChecksRepository();
    const store = createShoppingEntityStore(repo);

    await store.upsert({ item_key: 'rice', name: 'Rice' });
    expect(await store.readAll()).toEqual([{ item_key: 'rice', name: 'Rice' }]);

    await store.remove('["rice"]');
    expect(await repo.findAll()).toEqual([]);
  });
});
