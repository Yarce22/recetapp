import { enforceSuggestionMode } from '../enforce-suggestion-mode.ts';
import type { PreferencesDto, RawDishSuggestion } from '../index.ts';

const preferences = (overrides: Partial<PreferencesDto> = {}): PreferencesDto => ({
  suggestionMode: 'strict',
  maxMissingIngredients: 3,
  staples: ['water', 'salt', 'pepper', 'cooking oil'],
  dietary: [],
  dislikes: [],
  ...overrides,
});

const dish = (title: string, required: string[], optional: string[] = []): RawDishSuggestion => ({
  title,
  summary: 'A dish called ' + title,
  ingredients: [
    ...required.map((name) => ({ name, optional: false })),
    ...optional.map((name) => ({ name, optional: true })),
  ],
});

describe('enforceSuggestionMode - strict', () => {
  it('keeps a dish whose ingredients are all in the pantry', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato', 'onion'])],
      pantry: ['Tomato', 'Onion'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(1);
    expect(result.filteredOut).toBe(0);
  });

  it('drops the dish when the model slips in an ingredient the user does not have', () => {
    // The prompt asked for pantry-only. The model added garlic anyway.
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato', 'onion', 'garlic'])],
      pantry: ['Tomato', 'Onion'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(0);
    expect(result.filteredOut).toBe(1);
  });

  it('allows enabled staples without counting them as missing', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato', 'salt', 'cooking oil'])],
      pantry: ['Tomato'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(1);
  });

  it('drops the dish when a staple the user disabled is required', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato', 'cooking oil'])],
      pantry: ['Tomato'],
      preferences: preferences({ staples: ['water', 'salt'] }),
    });

    expect(result.kept).toHaveLength(0);
  });

  it('matches across spellings, so an accented name still counts', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Lemonade', ['limon', 'water'])],
      pantry: ['Limón'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(1);
  });

  it('reports coverage 1 and no missing ingredients on everything it keeps', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato'])],
      pantry: ['Tomato'],
      preferences: preferences(),
    });

    expect(result.kept[0].coverage).toBe(1);
    expect(result.kept[0].missingIngredients).toEqual([]);
  });

  it('ignores optional ingredients when deciding whether a dish is cookable', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato'], ['basil'])],
      pantry: ['Tomato'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(1);
  });
});

describe('enforceSuggestionMode - flexible', () => {
  it('keeps a dish that is a few ingredients short', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Pasta', ['pasta', 'tomato', 'basil'])],
      pantry: ['Tomato'],
      preferences: preferences({ suggestionMode: 'flexible', maxMissingIngredients: 3 }),
    });

    expect(result.kept).toHaveLength(1);
    expect([...result.kept[0].missingIngredients].sort()).toEqual(['basil', 'pasta']);
  });

  it('drops a dish that needs more than the allowed number of missing ingredients', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Paella', ['rice', 'saffron', 'shrimp', 'mussels'])],
      pantry: [],
      preferences: preferences({ suggestionMode: 'flexible', maxMissingIngredients: 3 }),
    });

    expect(result.kept).toHaveLength(0);
    expect(result.filteredOut).toBe(1);
  });

  it('computes coverage from the pantry rather than trusting the model', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Pasta', ['pasta', 'tomato'])],
      pantry: ['Tomato'],
      preferences: preferences({ suggestionMode: 'flexible' }),
    });

    expect(result.kept[0].coverage).toBe(0.5);
  });

  it('sorts by coverage so the most cookable dish comes first', () => {
    const result = enforceSuggestionMode({
      suggestions: [
        dish('Needs a lot', ['rice', 'shrimp', 'peas']),
        dish('Almost ready', ['tomato', 'onion', 'pasta']),
      ],
      pantry: ['Tomato', 'Onion'],
      preferences: preferences({ suggestionMode: 'flexible' }),
    });

    expect(result.kept.map((s) => s.title)).toEqual(['Almost ready', 'Needs a lot']);
  });
});

describe('enforceSuggestionMode - dislikes and safety', () => {
  it('drops a dish containing a disliked ingredient, in either mode', () => {
    for (const suggestionMode of ['strict', 'flexible'] as const) {
      const result = enforceSuggestionMode({
        suggestions: [dish('Satay', ['chicken', 'peanut'])],
        pantry: ['Chicken', 'Peanut'],
        preferences: preferences({ suggestionMode, dislikes: ['peanut'] }),
      });

      expect(result.kept).toHaveLength(0);
    }
  });

  it('drops the dish even when the disliked ingredient is marked optional', () => {
    // An allergy does not become safe because the model called it optional.
    const result = enforceSuggestionMode({
      suggestions: [dish('Salad', ['lettuce'], ['peanut'])],
      pantry: ['Lettuce'],
      preferences: preferences({ dislikes: ['Peanut'] }),
    });

    expect(result.kept).toHaveLength(0);
  });

  it('drops a suggestion with no ingredients at all, because nothing can be verified', () => {
    const result = enforceSuggestionMode({
      suggestions: [{ title: 'Mystery', summary: 'Trust me', ingredients: [] }],
      pantry: ['Tomato'],
      preferences: preferences(),
    });

    expect(result.kept).toHaveLength(0);
    expect(result.filteredOut).toBe(1);
  });

  it('stamps every kept suggestion with the mode it was filtered under', () => {
    const result = enforceSuggestionMode({
      suggestions: [dish('Tomato salad', ['tomato'])],
      pantry: ['Tomato'],
      preferences: preferences({ suggestionMode: 'flexible' }),
    });

    expect(result.kept[0].mode).toBe('flexible');
  });

  it('gives a deterministic id for the same dish title', () => {
    const run = () =>
      enforceSuggestionMode({
        suggestions: [dish('Tomato salad', ['tomato'])],
        pantry: ['Tomato'],
        preferences: preferences(),
      }).kept[0].id;

    expect(run()).toBe(run());
  });
});
