import { fireEvent, screen } from '@testing-library/react-native';

import type { ShoppingListItem } from '@/features/shopping-list/domain/build-shopping-list';
import { ShoppingListView } from '@/features/shopping-list/ui/shopping-list-view';
import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

const item = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  name: 'pasta',
  reasons: ['missing-for-plan'],
  neededFor: ['Noche de pasta'],
  ...overrides,
});

describe('ShoppingListView in Spanish', () => {
  it('says why an item is on the list', async () => {
    await renderInLanguage(
      <ShoppingListView
        items={[item({ reasons: ['low-stock', 'missing-for-plan'] })]}
        checked={new Set()}
        onToggle={jest.fn()}
      />,
      'es',
    );

    expect(screen.getByText('se está acabando · necesario para Noche de pasta')).toBeTruthy();
  });

  it('labels the checkbox for a screen reader in both states', async () => {
    const onToggle = jest.fn();
    await renderInLanguage(
      <ShoppingListView items={[item()]} checked={new Set()} onToggle={onToggle} />,
      'es',
    );

    fireEvent.press(screen.getByLabelText('Marcar pasta'));
    expect(onToggle).toHaveBeenCalledWith('pasta');
  });

  it('offers to untick an item that is ticked', async () => {
    await renderInLanguage(
      <ShoppingListView items={[item()]} checked={new Set(['pasta'])} onToggle={jest.fn()} />,
      'es',
    );

    expect(screen.getByLabelText('Desmarcar pasta')).toBeTruthy();
  });

  it('translates the empty state', async () => {
    await renderInLanguage(
      <ShoppingListView items={[]} checked={new Set()} onToggle={jest.fn()} />,
      'es',
    );

    expect(screen.getByText('Nada que comprar')).toBeTruthy();
  });
});
