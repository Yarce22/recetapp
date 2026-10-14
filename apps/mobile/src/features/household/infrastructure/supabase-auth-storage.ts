import type { SettingsRepository } from '@/shared/settings/settings-repository';

const PREFIX = 'supabase-auth:';

/**
 * Persists the Supabase session in the app's own settings table.
 *
 * supabase-js wants an AsyncStorage-shaped object. The app already has local
 * storage (SQLite), so adapting it avoids adding a native storage package, which
 * would force a new APK instead of an OTA update.
 */
export class SupabaseAuthStorage {
  constructor(private readonly settings: SettingsRepository) {}

  async getItem(key: string): Promise<string | null> {
    const value = await this.settings.get(PREFIX + key);
    // The settings port has no delete; an empty value stands for "removed".
    return value === null || value === '' ? null : value;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.settings.set(PREFIX + key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.settings.set(PREFIX + key, '');
  }
}
