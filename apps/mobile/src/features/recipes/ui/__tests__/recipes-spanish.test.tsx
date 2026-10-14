import { screen } from '@testing-library/react-native';

import type { DishSuggestionDto, RecipeDto } from '@recetapp/contracts';

import { RecipeDetail } from '@/features/recipes/ui/recipe-detail';
import { SuggestionList } from '@/features/recipes/ui/suggestion-list';
import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

const recipe: RecipeDto = {
  id: 'ensalada',
  title: 'Ensalada de tomate',
  servings: 2,
  ingredients: [
    { name: 'tomate', quantity: { amount: 400, unit: 'g' }, optional: false },
    { name: 'albahaca', quantity: { amount: 1, unit: 'pinch' }, optional: true },
  ],
  steps: ['Cortar los tomates.', 'Aliñar y servir.'],
  timeMinutes: 10,
  difficulty: 'easy',
};

const suggestion = (overrides: Partial<DishSuggestionDto> = {}): DishSuggestionDto => ({
  id: 'ensalada',
  title: 'Ensalada de tomate',
  summary: 'Fresca y rápida.',
  matchedIngredients: ['tomate'],
  missingIngredients: [],
  coverage: 1,
  mode: 'strict',
  ...overrides,
});

describe('RecipeDetail in Spanish', () => {
  async function renderDetail(missingIngredients: string[] = []) {
    return renderInLanguage(
      <RecipeDetail
        recipe={recipe}
        missingIngredients={missingIngredients}
        onServingsChange={jest.fn()}
        cookStatus="idle"
        notUpdated={[]}
        onCook={jest.fn()}
      />,
      'es',
    );
  }

  it('labels the cooked button in Spanish', async () => {
    await renderDetail();

    expect(screen.getByText('Receta preparada')).toBeTruthy();
  });

  it('translates the headings and keeps the generated text as it came', async () => {
    await renderDetail();

    expect(screen.getByText('Ensalada de tomate')).toBeTruthy();
    expect(screen.getByText('Ingredientes')).toBeTruthy();
    expect(screen.getByText('Pasos')).toBeTruthy();
    expect(screen.getByText('Cortar los tomates.')).toBeTruthy();
  });

  it('shows the difficulty enum as a Spanish word', async () => {
    await renderDetail();

    expect(screen.getByText('fácil')).toBeTruthy();
    expect(screen.queryByText('easy')).toBeNull();
  });

  it('translates the units and marks optional ingredients', async () => {
    await renderDetail();

    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.getByText('1 pizca')).toBeTruthy();
    expect(screen.getByText('albahaca (opcional)')).toBeTruthy();
  });

  it('labels the servings controls for a screen reader in Spanish', async () => {
    await renderDetail();

    expect(screen.getByLabelText('2 porciones')).toBeTruthy();
    expect(screen.getByLabelText('Más porciones')).toBeTruthy();
    expect(screen.getByLabelText('Menos porciones')).toBeTruthy();
  });

  it('says what has to be bought', async () => {
    await renderDetail(['albahaca']);

    expect(screen.getByText('Necesitas comprar: albahaca')).toBeTruthy();
  });
});

describe('SuggestionList in Spanish', () => {
  it('marks a dish that can be cooked now', async () => {
    await renderInLanguage(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={0}
        mode="strict"
        onSelect={jest.fn()}
      />,
      'es',
    );

    expect(screen.getByText('Listo para cocinar')).toBeTruthy();
    expect(screen.getByText('100% en la despensa')).toBeTruthy();
    expect(screen.getByLabelText('100% de los ingredientes está en tu despensa')).toBeTruthy();
  });

  it('names what is missing', async () => {
    await renderInLanguage(
      <SuggestionList
        suggestions={[suggestion({ missingIngredients: ['azafrán'], coverage: 0.5 })]}
        filteredOut={0}
        mode="flexible"
        onSelect={jest.fn()}
      />,
      'es',
    );

    expect(screen.getByText('Faltan: azafrán')).toBeTruthy();
  });

  it('counts the dishes that were left out, in the right number', async () => {
    const { rerender } = await renderInLanguage(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={1}
        mode="strict"
        onSelect={jest.fn()}
      />,
      'es',
    );
    expect(screen.getByText('1 más no encaja con lo que tienes.')).toBeTruthy();

    rerender(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={3}
        mode="strict"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('3 más no encajan con lo que tienes.')).toBeTruthy();
  });

  it('explains an empty strict result and how to widen it', async () => {
    await renderInLanguage(
      <SuggestionList suggestions={[]} filteredOut={2} mode="strict" onSelect={jest.fn()} />,
      'es',
    );

    expect(screen.getByText('Nada que puedas preparar ahora')).toBeTruthy();
    expect(
      screen.getByText('2 platos necesitaban algo que no tienes. Cambia a flexible para verlos.'),
    ).toBeTruthy();
  });

  it('explains an empty flexible result', async () => {
    await renderInLanguage(
      <SuggestionList suggestions={[]} filteredOut={0} mode="flexible" onSelect={jest.fn()} />,
      'es',
    );

    expect(screen.getByText('No llegaron platos')).toBeTruthy();
  });
});
