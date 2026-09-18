/**
 * Port for small key/value settings: preferences, the device identifier.
 *
 * Separate from the pantry port because the lifecycle is different. Losing a
 * setting is an inconvenience; losing the pantry is losing user data.
 */
export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
