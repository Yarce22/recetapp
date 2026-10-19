import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ShoppingListItem } from '@/features/shopping-list/domain/build-shopping-list';
import { ShoppingListView } from '@/features/shopping-list/ui/shopping-list-view';

const item = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  name: 'pasta',
  neededFor: ['Pasta night'],
  ...overrides,
});

function renderView(props: Partial<React.ComponentProps<typeof ShoppingListView>> = {}) {
  return render(
    <ShoppingListView items={[item()]} checked={new Set()} onToggle={jest.fn()} {...props} />,
  );
}

describe('ShoppingListView', () => {
  it('lists what to buy', () => {
    renderView();

    expect(screen.getByText('pasta')).toBeTruthy();
  });

  it('says a thing is needed for the week and which dish wants it', () => {
    renderView();

    expect(screen.getByText(/needed for Pasta night/i)).toBeTruthy();
  });

  it('says when something is simply running low', () => {
    renderView({ items: [item({ name: 'Flour', neededFor: [] })] });

    expect(screen.getByText(/running low/i)).toBeTruthy();
  });

  it('names every dish that needs it, not just the first', () => {
    renderView({ items: [item({ neededFor: ['Pasta night', 'Lasagna'] })] });

    expect(screen.getByText(/Pasta night, Lasagna/)).toBeTruthy();
  });

  it('ticks an item off', () => {
    const onToggle = jest.fn();
    renderView({ onToggle });

    fireEvent.press(screen.getByLabelText('Tick off pasta'));

    expect(onToggle).toHaveBeenCalledWith('pasta');
  });

  it('shows an item as ticked once it is in the checked set', () => {
    renderView({ checked: new Set(['pasta']) });

    expect(screen.getByLabelText('Untick pasta')).toBeTruthy();
  });

  it('celebrates an empty list rather than leaving a blank screen', () => {
    renderView({ items: [] });

    expect(screen.getByText(/nothing to buy/i)).toBeTruthy();
  });

  it('shows the amount to buy next to the name when the item has one', () => {
    renderView({ items: [item({ quantities: [{ amount: 300, unit: 'g' }] })] });

    expect(screen.getByText(/300 g/)).toBeTruthy();
  });

  it('shows every amount when the units differ', () => {
    renderView({
      items: [
        item({
          quantities: [
            { amount: 100, unit: 'g' },
            { amount: 2, unit: 'unit' },
          ],
        }),
      ],
    });

    expect(screen.getByText(/100 g/)).toBeTruthy();
    expect(screen.getByText(/2 unit/)).toBeTruthy();
  });
});
