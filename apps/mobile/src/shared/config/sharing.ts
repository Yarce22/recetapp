/**
 * Where the shared-household backend (Supabase) lives.
 *
 * Both values are public by design: the URL is a hostname and the publishable
 * key (`sb_publishable_...`) only identifies the project. What protects the
 * data is Row Level Security on the server, not the secrecy of these strings.
 *
 * When either is missing, sharing is switched off and the app behaves exactly as
 * it did before: local only, no account, no network.
 */
export type SharingConfig = {
  url: string;
  key: string;
};

type SharingEnv = {
  url: string | undefined;
  key: string | undefined;
};

// Expo only inlines EXPO_PUBLIC_ variables written as a static property access,
// so they cannot be read through a dynamic lookup.
const bundledEnv: SharingEnv = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_KEY,
};

function isValidUrl(value: string): boolean {
  return (
    /^https:\/\/[^\s/]+/.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value)
  );
}

/** The configuration, or null when sharing is not set up in this build. */
export function getSharingConfig(env: SharingEnv = bundledEnv): SharingConfig | null {
  const url = env.url?.trim();
  const key = env.key?.trim();
  if (!url || !key || !isValidUrl(url)) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

export function isSharingAvailable(env: SharingEnv = bundledEnv): boolean {
  return getSharingConfig(env) !== null;
}
