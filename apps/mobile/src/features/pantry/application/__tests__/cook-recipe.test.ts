import { makeAddPantryItem } from '@/features/pantry/application/add-pantry-item';
import { makeCookRecipe } from '@/features/pantry/application/cook-recipe';
import { makeListPantry } from '@/features/pantry/application/list-pantry';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { InMemoryPantryRepository } from '@/features/pantry/infrastructure/in-memory-pantry-repository';

function setup() {
  const repository = new InMemoryPantryRepository();
  return {
    addPantryItem: makeAddPantryItem(repository),
    cookRecipe: makeCookRecipe(repository),
    listPantry: makeListPantry(repository),
  };
}

type Setup = ReturnType<typeof setup>;

async function stock(
  { addPantryItem }: Setup,
  name: string,
  amount: number,
  unit: 'g' | 'kg' | 'ml' | 'unit',
  threshold: ReturnType<typeof makeQuantity> | null = null,
) {
  await addPantryItem({
    name,
    category: 'other',
    quantity: makeQuantity(amount, unit),
    lowStockThreshold: threshold,
  });
}

describe('cookRecipe', () => {
  it('subtracts what the recipe used from the pantry', async () => {
    const ctx = setup();
    await stock(ctx, 'Tomato', 500, 'g');

    await ctx.cookRecipe({
      ingredients: [{ name: 'tomato', quantity: { amount: 200, unit: 'g' } }],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 300, unit: 'g' });
  });

  it('converts between units of the same dimension', async () => {
    const ctx = setup();
    await stock(ctx, 'Flour', 2, 'kg');

    await ctx.cookRecipe({
      ingredients: [{ name: 'flour', quantity: { amount: 500, unit: 'g' } }],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 1.5, unit: 'kg' });
  });

  it('matches names regardless of case and accents', async () => {
    const ctx = setup();
    await stock(ctx, 'Limón', 5, 'unit');

    await ctx.cookRecipe({
      ingredients: [{ name: 'limon', quantity: { amount: 2, unit: 'unit' } }],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 3, unit: 'unit' });
  });

  it('leaves an empty item at zero instead of going negative', async () => {
    const ctx = setup();
    await stock(ctx, 'Rice', 100, 'g');

    await ctx.cookRecipe({
      ingredients: [{ name: 'rice', quantity: { amount: 300, unit: 'g' } }],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 0, unit: 'g' });
  });

  it('keeps the low stock threshold so the shopping list can react', async () => {
    const ctx = setup();
    await stock(ctx, 'Milk', 1000, 'ml', makeQuantity(200, 'ml'));

    await ctx.cookRecipe({
      ingredients: [{ name: 'milk', quantity: { amount: 900, unit: 'ml' } }],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.lowStockThreshold).toEqual({ amount: 200, unit: 'ml' });
  });

  it('reports ingredients the pantry does not have, without failing', async () => {
    const ctx = setup();
    await stock(ctx, 'Tomato', 500, 'g');

    const result = await ctx.cookRecipe({
      ingredients: [
        { name: 'tomato', quantity: { amount: 100, unit: 'g' } },
        { name: 'basil', quantity: { amount: 5, unit: 'g' } },
      ],
    });

    expect(result.deducted.map((line) => line.name)).toEqual(['tomato']);
    expect(result.skipped).toEqual([{ name: 'basil', reason: 'not-in-pantry' }]);
  });

  it('skips ingredients whose units cannot be compared, leaving them untouched', async () => {
    const ctx = setup();
    await stock(ctx, 'Tomato', 5, 'unit');

    const result = await ctx.cookRecipe({
      ingredients: [{ name: 'tomato', quantity: { amount: 200, unit: 'g' } }],
    });

    expect(result.skipped).toEqual([{ name: 'tomato', reason: 'incompatible-units' }]);
    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 5, unit: 'unit' });
  });

  it('accumulates when a recipe lists the same ingredient twice', async () => {
    const ctx = setup();
    await stock(ctx, 'Butter', 100, 'g');

    await ctx.cookRecipe({
      ingredients: [
        { name: 'butter', quantity: { amount: 30, unit: 'g' } },
        { name: 'Butter', quantity: { amount: 20, unit: 'g' } },
      ],
    });

    const [entry] = await ctx.listPantry();
    expect(entry.item.quantity).toEqual({ amount: 50, unit: 'g' });
  });
});
