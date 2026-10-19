import { z } from 'zod';

import type { RawDishSuggestion } from '@recetapp/contracts';

/** Raised when the model's answer cannot be trusted as data. */
export class MalformedModelResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedModelResponseError';
  }
}

/**
 * Caps on what we will accept back.
 *
 * A language model can return anything: a refusal in prose, a thousand dishes,
 * a title the length of a novel. These bounds are not about the model
 * behaving; they are about a bad response staying a rejected request rather
 * than becoming a rendering problem, a payload problem, or a bill.
 */
const MAX_SUGGESTIONS = 12;
const MAX_INGREDIENTS_PER_DISH = 40;
const MAX_TITLE = 200;
const MAX_SUMMARY = 600;
const MAX_INGREDIENT_NAME = 120;

/** A two week plan of three meals is 42 slots; the model is asked for a few more. */
export const MAX_PLAN_SUGGESTIONS = 60;

const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: 'must not be blank' });

const quantitySchema = z.object({
  amount: z.number().finite().nonnegative(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'cup', 'pinch']),
});

const ingredientSchema = z.object({
  name: nonBlank(MAX_INGREDIENT_NAME),
  // Models frequently omit the flag. Assuming "required" is the safe default:
  // it can only make strict mode stricter, never let an ingredient slip in.
  optional: z.boolean().default(false),
  // Only asked for when the plan includes ingredients. A bad amount or unit
  // drops the quantity, not the dish: the name alone still feeds the shopping list.
  quantity: quantitySchema.optional().catch(undefined),
});

const suggestionSchema = z.object({
  title: nonBlank(MAX_TITLE),
  summary: nonBlank(MAX_SUMMARY),
  ingredients: z.array(ingredientSchema).max(MAX_INGREDIENTS_PER_DISH),
});

const responseSchemaFor = (max: number) =>
  z.object({
    suggestions: z.array(suggestionSchema).max(max),
  });

/**
 * Turns whatever the model returned into suggestions, or refuses.
 *
 * Unknown fields are dropped rather than forwarded: the app should only ever
 * see the shape it was compiled against.
 */
export function parseModelSuggestions(
  raw: unknown,
  options: { max?: number } = {},
): RawDishSuggestion[] {
  const result = responseSchemaFor(options.max ?? MAX_SUGGESTIONS).safeParse(raw);

  if (!result.success) {
    throw new MalformedModelResponseError(result.error.issues[0]?.message ?? 'invalid shape');
  }

  // Absent quantities stay absent rather than becoming `undefined` keys.
  return result.data.suggestions.map((suggestion) => ({
    ...suggestion,
    ingredients: suggestion.ingredients.map(({ quantity, ...rest }) =>
      quantity ? { ...rest, quantity } : rest,
    ),
  }));
}

/**
 * The response shape handed to Gemini as a structured-output schema.
 *
 * Asking for this shape makes a usable answer far more likely. It does not
 * make it certain, which is exactly why `parseModelSuggestions` still runs on
 * whatever comes back.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                optional: { type: 'boolean' },
              },
              required: ['name', 'optional'],
            },
          },
        },
        required: ['title', 'summary', 'ingredients'],
      },
    },
  },
  required: ['suggestions'],
} as const;

/**
 * Same as `GEMINI_RESPONSE_SCHEMA` with an amount and unit on every
 * ingredient, for plans that include ingredients with the menu.
 */
export const GEMINI_PLAN_WITH_INGREDIENTS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                optional: { type: 'boolean' },
                quantity: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number' },
                    unit: {
                      type: 'string',
                      enum: ['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'cup', 'pinch'],
                    },
                  },
                  required: ['amount', 'unit'],
                },
              },
              required: ['name', 'optional', 'quantity'],
            },
          },
        },
        required: ['title', 'summary', 'ingredients'],
      },
    },
  },
  required: ['suggestions'],
} as const;
