import { AppState } from 'react-native';

import { SqliteMealPlanRepository } from '@/features/meal-plan/infrastructure/sqlite-meal-plan-repository';
import { SqlitePantryRepository } from '@/features/pantry/infrastructure/sqlite-pantry-repository';
import { SqliteShoppingChecksRepository } from '@/features/shopping-list/infrastructure/sqlite-shopping-checks-repository';
import { getSharingConfig } from '@/shared/config/sharing';
import { getDatabase } from '@/shared/db/client';
import { createSettingsRepository } from '@/shared/settings/create-settings-repository';
import { SqliteSyncStore } from '@/shared/sync/sqlite-sync-store';

import { composeSharingRuntime, type SharingRuntime } from '../application/compose-sharing-runtime';

import {
  createMealPlanEntityStore,
  createPantryEntityStore,
  createShoppingEntityStore,
} from './entity-stores';
import { SupabaseBackend } from './supabase-backend';
import { UnavailableBackend } from './unavailable-backend';

let instance: Promise<SharingRuntime> | null = null;

/**
 * The sharing runtime for this process, built on first use.
 *
 * Call it once at startup (the UI phase does so from the root layout) so the
 * remembered household is restored and local writes start being queued. With no
 * Supabase configuration it returns a runtime that reports `available: false`
 * and never touches the network.
 */
export function getSharingRuntime(): Promise<SharingRuntime> {
  instance ??= (async () => {
    const config = getSharingConfig();
    const db = await getDatabase();
    const settings = await createSettingsRepository();
    const backend = config ? new SupabaseBackend(config, settings) : new UnavailableBackend();

    const runtime = composeSharingRuntime({
      available: config !== null,
      householdBackend: backend,
      syncBackend: backend,
      settings,
      store: new SqliteSyncStore(db),
      stores: {
        pantry_items: createPantryEntityStore(new SqlitePantryRepository(db)),
        meal_plan_entries: createMealPlanEntityStore(new SqliteMealPlanRepository(db)),
        shopping_items: createShoppingEntityStore(new SqliteShoppingChecksRepository(db)),
      },
    });

    await runtime.start();
    if (config) {
      AppState.addEventListener('change', (state) => {
        if (state === 'active') runtime.engine.onForeground();
      });
    }
    return runtime;
  })();

  return instance;
}
