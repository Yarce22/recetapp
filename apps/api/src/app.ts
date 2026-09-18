import { Hono } from 'hono';
import { z } from 'zod';

import {
  enforceSuggestionMode,
  type PreferencesDto,
  type RawDishSuggestion,
  type SuggestionsResponse,
} from '@recetapp/contracts';

import { MalformedModelResponseError } from './gemini/suggestion-schema.ts';
import type { RateLimiter } from './policy/rate-limit.ts';

/**
 * Port for whatever produces candidate dishes.
 *
 * The route depends on this rather than on Gemini, so the request handling,
 * the limits and the mode enforcement are all testable without a network call
 * or an API key.
 */
export type SuggestionEngine = {
  suggest(input: { pantry: string[]; preferences: PreferencesDto }): Promise<RawDishSuggestion[]>;
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

const requestSchema = z.object({
  pantry: z
    .array(z.object({ name: z.string().min(1).max(120), quantity: quantitySchema }))
    .max(300),
  preferences: preferencesSchema,
});

export function createApp(deps: { engine: SuggestionEngine; limiter: RateLimiter }) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/suggestions', async (c) => {
    // No accounts in the MVP, so the client identifies itself. This is the key
    // the per-device budget is counted against; the global budget is what
    // actually bounds the cost.
    const deviceId = c.req.header('x-device-id');
    if (!deviceId) {
      return c.json({ error: 'missing_device_id' }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400);
    }

    const decision = deps.limiter.check(deviceId);
    if (!decision.allowed) {
      return c.json({ error: 'rate_limited', scope: decision.reason }, 429, {
        'retry-after': String(decision.retryAfterSeconds ?? 60),
      });
    }

    const { pantry, preferences } = parsed.data;

    let raw: RawDishSuggestion[];
    try {
      raw = await deps.engine.suggest({
        pantry: pantry.map((entry) => entry.name),
        preferences,
      });
    } catch (cause) {
      // Upstream detail never reaches the client: it can carry the API key,
      // the prompt, or the model's own words. The server log is where that
      // belongs.
      console.error('suggestion engine failed', cause);
      const reason =
        cause instanceof MalformedModelResponseError ? 'model_unusable' : 'upstream_failed';
      return c.json({ error: reason }, 502);
    }

    // The prompt asked. This is what enforces.
    const { kept, filteredOut } = enforceSuggestionMode({
      suggestions: raw,
      pantry: pantry.map((entry) => entry.name),
      preferences,
    });

    const payload: SuggestionsResponse = { suggestions: kept, filteredOut };
    return c.json(payload);
  });

  return app;
}
