import { Hono } from 'hono';
import { z } from 'zod';

import {
  enforceSuggestionMode,
  findForbiddenIngredients,
  findMissingIngredients,
  scaleRecipe,
  suggestionIdFor,
  type PreferencesDto,
  type RawDishSuggestion,
  type RecipeDto,
  type RecipeResponse,
  type SuggestionsResponse,
} from '@recetapp/contracts';

import { MalformedModelResponseError } from './gemini/suggestion-schema.ts';
import type { RateLimiter } from './policy/rate-limit.ts';

/**
 * Port for whatever produces dishes and recipes.
 *
 * The routes depend on this rather than on Gemini, so request handling, the
 * limits and the safety rules are all testable without a network call or an
 * API key.
 */
export type SuggestionEngine = {
  suggest(input: { pantry: string[]; preferences: PreferencesDto }): Promise<RawDishSuggestion[]>;
  recipe(input: {
    title: string;
    pantry: string[];
    preferences: PreferencesDto;
  }): Promise<RecipeDto>;
};

const quantitySchema = z.object({
  amount: z.number().finite().nonnegative(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'cup', 'pinch']),
});

const preferencesSchema = z.object({
  suggestionMode: z.enum(['strict', 'flexible']),
  maxMissingIngredients: z.number().int().min(0).max(20),
  staples: z.array(z.string().max(120)).max(50),
  dietary: z.array(z.string().max(120)).max(30),
  dislikes: z.array(z.string().max(120)).max(50),
});

const pantrySchema = z
  .array(z.object({ name: z.string().min(1).max(120), quantity: quantitySchema }))
  .max(300);

const suggestionsRequestSchema = z.object({
  pantry: pantrySchema,
  preferences: preferencesSchema,
});

const recipeRequestSchema = z.object({
  title: z.string().min(1).max(200),
  pantry: pantrySchema,
  preferences: preferencesSchema,
  // Rejected here rather than in scaleRecipe, so a bad number is a bad
  // request instead of a server error.
  servings: z.number().int().positive().max(50).optional(),
});

/** Never leaks upstream detail: it can carry the key, the prompt, or the model's words. */
function upstreamFailure(cause: unknown) {
  console.error('suggestion engine failed', cause);
  return cause instanceof MalformedModelResponseError ? 'model_unusable' : 'upstream_failed';
}

export function createApp(deps: { engine: SuggestionEngine; limiter: RateLimiter }) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/suggestions', async (c) => {
    // No accounts in the MVP, so the client identifies itself. This is the key
    // the per-device budget is counted against; the global budget is what
    // actually bounds the cost.
    const deviceId = c.req.header('x-device-id');
    if (!deviceId) return c.json({ error: 'missing_device_id' }, 400);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const parsed = suggestionsRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

    const decision = deps.limiter.check(deviceId);
    if (!decision.allowed) {
      return c.json({ error: 'rate_limited', scope: decision.reason }, 429, {
        'retry-after': String(decision.retryAfterSeconds ?? 60),
      });
    }

    const { pantry, preferences } = parsed.data;
    const pantryNames = pantry.map((entry) => entry.name);

    let raw: RawDishSuggestion[];
    try {
      raw = await deps.engine.suggest({ pantry: pantryNames, preferences });
    } catch (cause) {
      return c.json({ error: upstreamFailure(cause) }, 502);
    }

    // The prompt asked. This is what enforces.
    const { kept, filteredOut } = enforceSuggestionMode({
      suggestions: raw,
      pantry: pantryNames,
      preferences,
    });

    const payload: SuggestionsResponse = { suggestions: kept, filteredOut };
    return c.json(payload);
  });

  app.post('/recipes/:id', async (c) => {
    const deviceId = c.req.header('x-device-id');
    if (!deviceId) return c.json({ error: 'missing_device_id' }, 400);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const parsed = recipeRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

    const { title, pantry, preferences, servings } = parsed.data;

    // The service keeps no record of which dish an id referred to, so the id
    // and the title have to agree with each other or the request is incoherent.
    if (suggestionIdFor(title) !== c.req.param('id')) {
      return c.json({ error: 'id_title_mismatch' }, 400);
    }

    const decision = deps.limiter.check(deviceId);
    if (!decision.allowed) {
      return c.json({ error: 'rate_limited', scope: decision.reason }, 429, {
        'retry-after': String(decision.retryAfterSeconds ?? 60),
      });
    }

    const pantryNames = pantry.map((entry) => entry.name);

    let recipe: RecipeDto;
    try {
      recipe = await deps.engine.recipe({ title, pantry: pantryNames, preferences });
    } catch (cause) {
      return c.json({ error: upstreamFailure(cause) }, 502);
    }

    const ingredientNames = recipe.ingredients.map((ingredient) => ingredient.name);

    // The dish cleared the suggestion filter. Its full ingredient list is new
    // information, and has to clear the same bar - this is where an allergen
    // would otherwise slip through.
    const forbidden = findForbiddenIngredients(ingredientNames, preferences);
    if (forbidden.length > 0) {
      return c.json({ error: 'recipe_violates_preferences', ingredients: forbidden }, 422);
    }

    let scaled: RecipeDto;
    try {
      scaled = servings ? scaleRecipe(recipe, servings) : recipe;
    } catch {
      // A recipe that claims zero servings cannot be scaled; that is the
      // model's fault, not the caller's.
      return c.json({ error: 'model_unusable' }, 502);
    }

    const payload: RecipeResponse = {
      recipe: scaled,
      missingIngredients: findMissingIngredients(ingredientNames, pantryNames, preferences),
    };
    return c.json(payload);
  });

  return app;
}
