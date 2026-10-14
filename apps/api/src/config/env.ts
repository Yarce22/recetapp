export type Env = {
  geminiApiKey: string;
  geminiModel: string;
  port: number;
  perDevicePerHour: number;
  globalPerHour: number;
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
}

/**
 * Reads configuration, failing at startup rather than on the first request.
 *
 * A missing key is a deployment mistake. Discovering it when a user taps
 * "find me something to cook" turns it into their problem instead of ours.
 */
export function loadEnv(): Env {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. The key lives only on the server - see apps/api/.env.example.',
    );
  }

  return {
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite',
    port: intFromEnv('PORT', 8787),
    perDevicePerHour: intFromEnv('RATE_LIMIT_PER_DEVICE_PER_HOUR', 30),
    globalPerHour: intFromEnv('RATE_LIMIT_GLOBAL_PER_HOUR', 500),
  };
}
