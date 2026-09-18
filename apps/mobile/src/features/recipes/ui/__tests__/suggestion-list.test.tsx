import { render, screen } from '@testing-library/react-native';

import type { DishSuggestionDto } from '@recetapp/contracts';

import { SuggestionList } from '@/features/recipes/ui/suggestion-list';

const suggestion = (overrides: Partial<DishSuggestionDto> = {}): DishSuggestionDto => ({
  id: 'tomato-salad',
  title: 'Tomato salad',
  summary: 'Fresh and quick.',
  matchedIngredients: ['tomato'],
  missingIngredients: [],
  coverage: 1,
  mode: 'strict',
  ...overrides,
});

describe('SuggestionList', () => {
  it('shows each dish with its summary', () => {
    render(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={0}
        mode="strict"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Tomato salad')).toBeTruthy();
    expect(screen.getByText('Fresh and quick.')).toBeTruthy();
  });

  it('marks a dish you can cook right now', () => {
    render(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={0}
        mode="strict"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Ready to cook')).toBeTruthy();
  });

  it('says what is missing instead of only showing a percentage', () => {
    render(
      <SuggestionList
        suggestions={[suggestion({ missingIngredients: ['pasta', 'basil'], coverage: 0.5 })]}
        filteredOut={0}
        mode="flexible"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Missing: pasta, basil')).toBeTruthy();
  });

  it('reports how many were filtered out, rather than hiding it', () => {
    render(
      <SuggestionList
        suggestions={[suggestion()]}
        filteredOut={3}
        mode="strict"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText(/3 more did not fit/i)).toBeTruthy();
  });

  it('explains an empty strict result and points at the way out', () => {
    render(
      <SuggestionList suggestions={[]} filteredOut={5} mode="strict" onSelect={jest.fn()} />,
    );

    expect(screen.getByText(/nothing you can make/i)).toBeTruthy();
    expect(screen.getByText(/flexible/i)).toBeTruthy();
  });

  it('explains an empty flexible result differently, since switching mode will not help', () => {
    render(
      <SuggestionList suggestions={[]} filteredOut={0} mode="flexible" onSelect={jest.fn()} />,
    );

    expect(screen.getByText(/add a few more ingredients/i)).toBeTruthy();
  });
});
