import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RecipeDto } from '@recetapp/contracts';

import { RecipeDetail } from '@/features/recipes/ui/recipe-detail';

const recipe: RecipeDto = {
  id: 'tomato-salad',
  title: 'Tomato salad',
  servings: 2,
  ingredients: [
    { name: 'tomato', quantity: { amount: 400, unit: 'g' }, optional: false },
    { name: 'basil', quantity: { amount: 5, unit: 'g' }, optional: true },
  ],
  steps: ['Chop the tomatoes.', 'Dress and serve.'],
  timeMinutes: 10,
  difficulty: 'easy',
};

function renderDetail(props: Partial<React.ComponentProps<typeof RecipeDetail>> = {}) {
  return render(
    <RecipeDetail
      recipe={recipe}
      missingIngredients={[]}
      onServingsChange={jest.fn()}
      cookStatus="idle"
      notUpdated={[]}
      onCook={jest.fn()}
      {...props}
    />,
  );
}

describe('RecipeDetail', () => {
  it('shows the title, the time and the servings', () => {
    renderDetail();

    expect(screen.getByText('Tomato salad')).toBeTruthy();
    expect(screen.getByText(/10 min/)).toBeTruthy();
    // Labelled, because a bare number between two buttons tells a screen
    // reader nothing.
    expect(screen.getByLabelText('2 servings')).toBeTruthy();
  });

  it('lists every ingredient with its amount', () => {
    renderDetail();

    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.getByText('tomato')).toBeTruthy();
  });

  it('marks optional ingredients so the cook knows what can be skipped', () => {
    renderDetail();

    expect(screen.getByText(/basil \(optional\)/)).toBeTruthy();
  });

  it('flags the ingredients the pantry cannot cover', () => {
    renderDetail({ missingIngredients: ['basil'] });

    expect(screen.getByText(/you need to buy: basil/i)).toBeTruthy();
  });

  it('numbers the steps, because order is the whole point of a recipe', () => {
    renderDetail();

    expect(screen.getByText('Chop the tomatoes.')).toBeTruthy();
    expect(screen.getByText('Dress and serve.')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('asks for more servings when the plus control is used', () => {
    const onServingsChange = jest.fn();
    renderDetail({ onServingsChange });

    fireEvent.press(screen.getByLabelText('More servings'));

    expect(onServingsChange).toHaveBeenCalledWith(3);
  });

  it('asks for fewer servings when the minus control is used', () => {
    const onServingsChange = jest.fn();
    renderDetail({ onServingsChange });

    fireEvent.press(screen.getByLabelText('Fewer servings'));

    expect(onServingsChange).toHaveBeenCalledWith(1);
  });

  it('offers a way to mark the recipe as cooked', () => {
    const onCook = jest.fn();
    renderDetail({ onCook });

    fireEvent.press(screen.getByText('Recipe cooked'));

    expect(onCook).toHaveBeenCalledTimes(1);
  });

  it('confirms the pantry was updated and removes the button once cooked', () => {
    renderDetail({ cookStatus: 'done' });

    expect(screen.getByText(/pantry updated/i)).toBeTruthy();
    expect(screen.queryByText('Recipe cooked')).toBeNull();
  });

  it('names the ingredients that could not be deducted', () => {
    renderDetail({ cookStatus: 'done', notUpdated: ['basil'] });

    expect(screen.getByText(/not updated: basil/i)).toBeTruthy();
  });

  it('never offers to go below one serving', () => {
    const onServingsChange = jest.fn();
    renderDetail({ recipe: { ...recipe, servings: 1 }, onServingsChange });

    fireEvent.press(screen.getByLabelText('Fewer servings'));

    expect(onServingsChange).not.toHaveBeenCalled();
  });
});
