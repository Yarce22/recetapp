/**
 * Where the BFF lives.
 *
 * EXPO_PUBLIC_ variables are compiled into the bundle and readable by anyone
 * who unpacks the app. That is fine for a base URL and would not be fine for a
 * key, which is exactly why the key is not here.
 *
 * The default points at a dev server on the host machine. On a physical device
 * localhost is the phone itself, so set EXPO_PUBLIC_API_URL to the machine IP
 * that Expo prints when it starts.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export const DEVICE_ID_SETTING_KEY = 'device-id';
export const PREFERENCES_SETTING_KEY = 'preferences';
