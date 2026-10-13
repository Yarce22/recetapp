import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { InvalidIngredientError, InvalidQuantityError } from '@/features/pantry/domain/errors';
import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { AddPantryItemForm } from '@/features/pantry/ui/add-pantry-item-form';
import { formatQuantity } from '@/features/pantry/ui/format-quantity';
import { PantryList } from '@/features/pantry/ui/pantry-list';
import { createTranslator } from '@/shared/i18n/translator';
import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

function entry(name: string, amount: number, threshold: number | null): PantryEntry {
  return {
    ingredient: createIngredient({
      id: name.toLowerCase(),
      name,
      category: 'other',
      defaultUnit: 'g',
    }),
    item: createPantryItem({
      ingredientId: name.toLowerCase(),
      quantity: makeQuantity(amount, 'g'),
      lowStockThreshold: threshold === null ? null : makeQuantity(threshold, 'g'),
    }),
  };
}

describe('formatQuantity', () => {
  it('uses the decimal comma and unit names of the language', async () => {
    const es = createTranslator('es');

    expect(formatQuantity(makeQuantity(0.5, 'kg'), es)).toBe('0,5 kg');
    expect(formatQuantity(makeQuantity(2, 'unit'), es)).toBe('2 ud.');
  });

  it('keeps the English format when no translator is given', async () => {
    expect(formatQuantity(makeQuantity(0.5, 'kg'))).toBe('0.5 kg');
    expect(formatQuantity(makeQuantity(2, 'unit'))).toBe('2 unit');
  });
});

describe('PantryList in Spanish', () => {
  it('translates the empty state', async () => {
    await renderInLanguage(<PantryList entries={[]} onSelect={jest.fn()} />, 'es');

    expect(screen.getByText('Tu despensa está vacía por ahora')).toBeTruthy();
  });

  it('translates the low badge and the row hint, and keeps what the user typed', async () => {
    await renderInLanguage(
      <PantryList entries={[entry('Harina', 100, 500)]} onSelect={jest.fn()} />,
      'es',
    );

    expect(screen.getByText('Harina')).toBeTruthy();
    expect(screen.getByText('Poco')).toBeTruthy();
    expect(screen.getByText('100 g')).toBeTruthy();
    expect(screen.getByHintText('Lo quita de la despensa')).toBeTruthy();
  });
});

describe('AddPantryItemForm in Spanish', () => {
  it('translates the labels, the categories and the button', async () => {
    await renderInLanguage(<AddPantryItemForm onSubmit={jest.fn()} />, 'es');

    expect(screen.getByText('Ingrediente')).toBeTruthy();
    expect(screen.getByText('Categoría')).toBeTruthy();
    expect(screen.getByText('Lácteos')).toBeTruthy();
    expect(screen.getByText('Frutas y verduras')).toBeTruthy();
    expect(screen.getByText('Agregar a la despensa')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad')).toBeTruthy();
  });

  it('keeps the stored category identifier whatever the label says', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await renderInLanguage(<AddPantryItemForm onSubmit={onSubmit} />, 'es');

    fireEvent.changeText(screen.getByLabelText('Ingrediente'), 'Leche');
    fireEvent.press(screen.getByText('Lácteos'));
    fireEvent.changeText(screen.getByLabelText('Cantidad'), '1,5');
    fireEvent.press(screen.getByText('Agregar a la despensa'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Leche',
      category: 'dairy',
      quantity: { amount: 1.5, unit: 'g' },
    });
  });

  it('explains a bad amount in Spanish', async () => {
    await renderInLanguage(<AddPantryItemForm onSubmit={jest.fn()} />, 'es');

    fireEvent.changeText(screen.getByLabelText('Ingrediente'), 'Leche');
    fireEvent.changeText(screen.getByLabelText('Cantidad'), 'mucho');
    fireEvent.press(screen.getByText('Agregar a la despensa'));

    expect(await screen.findByText('Ingresa la cantidad que tienes, como número.')).toBeTruthy();
  });

  it.each([
    [
      new InvalidIngredientError('An ingredient needs a name.'),
      'El ingrediente necesita un nombre.',
    ],
    [
      new InvalidQuantityError('Amount cannot be negative, got -1.'),
      'La cantidad no puede ser negativa.',
    ],
    [new Error('disk is full'), 'No se pudo guardar este elemento.'],
  ])('translates what the domain rejects (%s)', async (failure, expected) => {
    await renderInLanguage(
      <AddPantryItemForm onSubmit={jest.fn().mockRejectedValue(failure)} />,
      'es',
    );

    fireEvent.changeText(screen.getByLabelText('Cantidad'), '5');
    fireEvent.press(screen.getByText('Agregar a la despensa'));

    expect(await screen.findByText(expected)).toBeTruthy();
  });
});
