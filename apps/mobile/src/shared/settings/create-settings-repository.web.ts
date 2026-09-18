import { InMemorySettingsRepository } from './in-memory-settings-repository';
import type { SettingsRepository } from './settings-repository';

/**
 * Web settings storage: in memory, like the web pantry.
 *
 * Keeps expo-sqlite out of the web bundle. Preferences reset on reload, which
 * matches the rest of the web build.
 */
export async function createSettingsRepository(): Promise<SettingsRepository> {
  return new InMemorySettingsRepository();
}
