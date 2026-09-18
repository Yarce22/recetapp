import { z } from 'zod';

import { suggestionIdFor, type RecipeDto } from '@recetapp/contracts';

import { MalformedModelResponseError } from './suggestion-schema.ts';

const MAX_INGREDIENTS = 40;
const MAX_STEPS = 40;
const MAX_STEP_LENGTH = 1000;
const MAX_SERVINGS = 50;
const MAX_MINUTES = 24 * 60;

const UNITS = ['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'cup', 'pinch'] as const;

const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: 'must not be blank' });

const ingredientSchema = z.object({
  name: nonBlank(120),
  // A quantity has to be usable arithmetic. A model that answers "a handful"
  // is answering a different question than the one the app asked.
  amount: z.number().finite().positive().max(100_000),
  unit: z.enum(UNITS),
  optional: z.boolean().default(false),
});

const recipeSchema = z.object({
  title: nonBlank(200),
  // Zero servings would make the scaling arithmetic undefined, so it is
  // rejected here rather than blowing up later.
  servings: z.number().int().positive().max(MAX_SERVINGS),
  timeMinutes: z.number().int().positive().max(MAX_MINUTES),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(ingredientSchema).min(1).max(MAX_INGREDIENTS),
  steps: z.array(nonBlank(MAX_STEP_LENGTH)).min(1).max(MAX_STEPS),
});

/**
 * Turns the model's answer into a recipe, or refuses.
 *
 * A recipe with no steps or no ingredients is not a recipe, however confident
 * the prose around it sounds, so both are required rather than defaulted to
 * empty.
 */
export function parseModelRecipe(raw: unknown): RecipeDto {
  const result = recipeSchema.safeParse(raw);

  if (!result.success) {
    throw new MalformedModelResponseError(result.error.issues[0]?.message ?? 'invalid shape');
  }

  const data = result.data;

  return {
    id: suggestionIdFor(data.title),
    title: data.title,
    servings: data.servings,
    timeMinutes: data.timeMinutes,
    difficulty: data.difficulty,
    ingredients: data.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: { amount: ingredient.amount, unit: ingredient.unit },
      optional: ingredient.optional,
    })),
    steps: data.steps,
  };
}

/** Structured-output schema handed to Gemini. Requested, never assumed. */
export const GEMINI_RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    servings: { type: 'integer' },
    timeMinutes: { type: 'integer' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string', enum: [...UNITS] },
          optional: { type: 'boolean' },
        },
        required: ['name', 'amount', 'unit', 'optional'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'servings', 'timeMinutes', 'difficulty', 'ingredients', 'steps'],
} as const;
