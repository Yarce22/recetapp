import { render, screen } from '@testing-library/react-native';

import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { PantryList } from '@/features/pantry/ui/pantry-list';

function entry(name: string, amount: number, threshold: number | null): PantryEntry {
  return {
    ingredient: createIngredient({ id: name.toLowerCase(), name, category: 'other', defaultUnit: 'g' }),
    item: createPantryItem({
      ingredientId: name.toLowerCase(),
      quantity: makeQuantity(amount, 'g'),
      lowStockThreshold: threshold === null ? null : makeQuantity(threshold, 'g'),
    }),
  };
}

describe('PantryList', () => {
  it('renders one row per ingredient with its amount', () => {
    render(<PantryList entries={[entry('Tomato', 500, null)]} onSelect={jest.fn()} />);

    expect(screen.getByText('Tomato')).toBeTruthy();
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  it('flags the items that are running low', () => {
    render(
      <PantryList
        entries={[entry('Flour', 100, 500), entry('Sugar', 2000, 500)]}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Low')).toHaveLength(1);
  });

  it('tells the user what to do when the pantry is empty', () => {
    render(<PantryList entries={[]} onSelect={jest.fn()} />);

    expect(screen.getByText(/nothing in your pantry/i)).toBeTruthy();
  });
});
