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

const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: 'must not be blank' });

const ingredientSchema = z.object({
  name: nonBlank(MAX_INGREDIENT_NAME),
  // Models frequently omit the flag. Assuming "required" is the safe default:
  // it can only make strict mode stricter, never let an ingredient slip in.
  optional: z.boolean().default(false),
});

const suggestionSchema = z.object({
  title: nonBlank(MAX_TITLE),
  summary: nonBlank(MAX_SUMMARY),
  ingredients: z.array(ingredientSchema).max(MAX_INGREDIENTS_PER_DISH),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema).max(MAX_SUGGESTIONS),
});

/**
 * Turns whatever the model returned into suggestions, or refuses.
 *
 * Unknown fields are dropped rather than forwarded: the app should only ever
 * see the shape it was compiled against.
 */
export function parseModelSuggestions(raw: unknown): RawDishSuggestion[] {
  const result = responseSchema.safeParse(raw);

  if (!result.success) {
    throw new MalformedModelResponseError(result.error.issues[0]?.message ?? 'invalid shape');
  }

  return result.data.suggestions;
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
