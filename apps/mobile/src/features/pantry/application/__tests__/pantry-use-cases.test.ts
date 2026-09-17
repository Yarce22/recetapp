import { makeAddPantryItem } from '@/features/pantry/application/add-pantry-item';
import { makeListLowStockItems } from '@/features/pantry/application/list-low-stock-items';
import { makeListPantry } from '@/features/pantry/application/list-pantry';
import { makeRemovePantryItem } from '@/features/pantry/application/remove-pantry-item';
import { makeUpdatePantryQuantity } from '@/features/pantry/application/update-pantry-quantity';
import { PantryItemNotFoundError } from '@/features/pantry/domain/errors';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { InMemoryPantryRepository } from '@/features/pantry/infrastructure/in-memory-pantry-repository';

function setup() {
  const repository = new InMemoryPantryRepository();
  return {
    repository,
    addPantryItem: makeAddPantryItem(repository),
    updatePantryQuantity: makeUpdatePantryQuantity(repository),
    removePantryItem: makeRemovePantryItem(repository),
    listPantry: makeListPantry(repository),
    listLowStockItems: makeListLowStockItems(repository),
  };
}

describe('addPantryItem', () => {
  it('stores a new ingredient with its quantity', async () => {
    const { addPantryItem, listPantry } = setup();

    await addPantryItem({
      name: 'Tomato',
      category: 'produce',
      quantity: makeQuantity(500, 'g'),
      lowStockThreshold: null,
    });

    const pantry = await listPantry();
    expect(pantry).toHaveLength(1);
    expect(pantry[0].ingredient.displayName).toBe('Tomato');
    expect(pantry[0].item.quantity).toEqual({ amount: 500, unit: 'g' });
  });

  it('adds to the existing amount instead of creating a duplicate', async () => {
    const { addPantryItem, listPantry } = setup();

    await addPantryItem({
      name: 'Tomato',
      category: 'produce',
      quantity: makeQuantity(500, 'g'),
      lowStockThreshold: null,
    });
    await addPantryItem({
      name: 'tomato',
      category: 'produce',
      quantity: makeQuantity(1, 'kg'),
      lowStockThreshold: null,
    });

    const pantry = await listPantry();
    expect(pantry).toHaveLength(1);
    expect(pantry[0].item.quantity).toEqual({ amount: 1500, unit: 'g' });
  });

  it('treats accented and unaccented spellings as the same ingredient', async () => {
    const { addPantryItem, listPantry } = setup();

    await addPantryItem({
      name: 'Limón',
      category: 'produce',
      quantity: makeQuantity(3, 'unit'),
      lowStockThreshold: null,
    });
    await addPantryItem({
      name: 'limon',
      category: 'produce',
      quantity: makeQuantity(2, 'unit'),
      lowStockThreshold: null,
    });

    const pantry = await listPantry();
    expect(pantry).toHaveLength(1);
    expect(pantry[0].item.quantity).toEqual({ amount: 5, unit: 'unit' });
  });
});

describe('updatePantryQuantity', () => {
  it('replaces the quantity rather than adding to it', async () => {
    const { addPantryItem, updatePantryQuantity, listPantry } = setup();

    await addPantryItem({
      name: 'Rice',
      category: 'grain',
      quantity: makeQuantity(1, 'kg'),
      lowStockThreshold: null,
    });
    await updatePantryQuantity({ ingredientId: 'rice', quantity: makeQuantity(300, 'g') });

    const pantry = await listPantry();
    expect(pantry[0].item.quantity).toEqual({ amount: 300, unit: 'g' });
  });

  it('fails when the ingredient is not in the pantry', async () => {
    const { updatePantryQuantity } = setup();

    await expect(
      updatePantryQuantity({ ingredientId: 'saffron', quantity: makeQuantity(1, 'g') }),
    ).rejects.toThrow(PantryItemNotFoundError);
  });
});

describe('removePantryItem', () => {
  it('removes the ingredient', async () => {
    const { addPantryItem, removePantryItem, listPantry } = setup();

    await addPantryItem({
      name: 'Milk',
      category: 'dairy',
      quantity: makeQuantity(1, 'l'),
      lowStockThreshold: null,
    });
    await removePantryItem({ ingredientId: 'milk' });

    expect(await listPantry()).toHaveLength(0);
  });
});

describe('listLowStockItems', () => {
  it('returns only the items at or below their threshold', async () => {
    const { addPantryItem, listLowStockItems } = setup();

    await addPantryItem({
      name: 'Flour',
      category: 'grain',
      quantity: makeQuantity(100, 'g'),
      lowStockThreshold: makeQuantity(500, 'g'),
    });
    await addPantryItem({
      name: 'Sugar',
      category: 'grain',
      quantity: makeQuantity(2, 'kg'),
      lowStockThreshold: makeQuantity(500, 'g'),
    });
    await addPantryItem({
      name: 'Salt',
      category: 'spice',
      quantity: makeQuantity(10, 'g'),
      lowStockThreshold: null,
    });

    const low = await listLowStockItems();
    expect(low.map((entry) => entry.ingredient.name)).toEqual(['flour']);
  });
});

describe('listPantry', () => {
  it('sorts alphabetically by display name, so the list is predictable', async () => {
    const { addPantryItem, listPantry } = setup();

    for (const name of ['Rice', 'Apple', 'Milk']) {
      await addPantryItem({
        name,
        category: 'other',
        quantity: makeQuantity(1, 'unit'),
        lowStockThreshold: null,
      });
    }

    const pantry = await listPantry();
    expect(pantry.map((entry) => entry.ingredient.displayName)).toEqual(['Apple', 'Milk', 'Rice']);
  });
});
