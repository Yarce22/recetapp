import { MalformedModelResponseError, parseModelSuggestions } from '../suggestion-schema.ts';

const valid = {
  suggestions: [
    {
      title: 'Tomato salad',
      summary: 'Fresh and quick.',
      ingredients: [
        { name: 'tomato', optional: false },
        { name: 'basil', optional: true },
      ],
    },
  ],
};

describe('parseModelSuggestions', () => {
  it('accepts a well formed response', () => {
    const parsed = parseModelSuggestions(valid);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Tomato salad');
    expect(parsed[0].ingredients[1].optional).toBe(true);
  });

  it('rejects a response that is not an object', () => {
    expect(() => parseModelSuggestions('sorry, I cannot help with that')).toThrow(
      MalformedModelResponseError,
    );
    expect(() => parseModelSuggestions(null)).toThrow(MalformedModelResponseError);
  });

  it('rejects a suggestion missing its ingredients', () => {
    expect(() =>
      parseModelSuggestions({ suggestions: [{ title: 'Mystery', summary: 'Trust me' }] }),
    ).toThrow(MalformedModelResponseError);
  });

  it('rejects an empty title', () => {
    expect(() =>
      parseModelSuggestions({
        suggestions: [{ title: '   ', summary: 'x', ingredients: [{ name: 'a', optional: false }] }],
      }),
    ).toThrow(MalformedModelResponseError);
  });

  it('defaults optional to false when the model omits it', () => {
    const parsed = parseModelSuggestions({
      suggestions: [{ title: 'Soup', summary: 'x', ingredients: [{ name: 'water' }] }],
    });

    expect(parsed[0].ingredients[0].optional).toBe(false);
  });

  it('drops unknown fields the model invented', () => {
    const parsed = parseModelSuggestions({
      suggestions: [
        {
          title: 'Soup',
          summary: 'x',
          calories: 9000,
          ingredients: [{ name: 'water', optional: false, brand: 'Acme' }],
        },
      ],
    });

    expect(parsed[0]).not.toHaveProperty('calories');
    expect(parsed[0].ingredients[0]).not.toHaveProperty('brand');
  });

  it('rejects absurdly long strings rather than passing them to the app', () => {
    expect(() =>
      parseModelSuggestions({
        suggestions: [
          {
            title: 'x'.repeat(5000),
            summary: 'x',
            ingredients: [{ name: 'water', optional: false }],
          },
        ],
      }),
    ).toThrow(MalformedModelResponseError);
  });

  it('rejects a response with more suggestions than we asked for', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      title: `Dish ${i}`,
      summary: 'x',
      ingredients: [{ name: 'water', optional: false }],
    }));

    expect(() => parseModelSuggestions({ suggestions: many })).toThrow(MalformedModelResponseError);
  });

  it('rejects a dish with an implausible number of ingredients', () => {
    const ingredients = Array.from({ length: 200 }, (_, i) => ({
      name: `thing ${i}`,
      optional: false,
    }));

    expect(() =>
      parseModelSuggestions({ suggestions: [{ title: 'Everything', summary: 'x', ingredients }] }),
    ).toThrow(MalformedModelResponseError);
  });

  it('accepts an empty suggestion list, which is a real answer', () => {
    expect(parseModelSuggestions({ suggestions: [] })).toEqual([]);
  });
});
