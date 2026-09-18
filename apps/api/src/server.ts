import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createGeminiSuggestionEngine } from './gemini/gemini-suggestion-engine.ts';
import { createRateLimiter } from './policy/rate-limit.ts';

const env = loadEnv();

const app = createApp({
  engine: createGeminiSuggestionEngine({
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
  }),
  limiter: createRateLimiter({
    perDevicePerHour: env.perDevicePerHour,
    globalPerHour: env.globalPerHour,
  }),
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  // The key is never logged, here or anywhere else.
  console.log(`RecetApp BFF listening on http://localhost:${info.port} (model ${env.geminiModel})`);
});
