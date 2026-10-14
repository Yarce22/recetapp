import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';
import { InMemoryPantryRepository } from '@/features/pantry/infrastructure/in-memory-pantry-repository';
import { InMemoryShoppingChecksRepository } from '@/features/shopping-list/infrastructure/in-memory-shopping-checks-repository';
import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';
import { InMemorySyncStore } from '@/shared/sync/in-memory-sync-store';

import { composeSharingRuntime, type SharingRuntime } from '../application/compose-sharing-runtime';

import {
  createMealPlanEntityStore,
  createPantryEntityStore,
  createShoppingEntityStore,
} from './entity-stores';
import { UnavailableBackend } from './unavailable-backend';

let instance: Promise<SharingRuntime> | null = null;

/**
 * Web build: sharing is never available. The web build keeps its data in
 * memory, so there is nothing durable to share and no reason to pull supabase-js
 * into the bundle.
 */
export function getSharingRuntime(): Promise<SharingRuntime> {
  instance ??= (async () => {
    const backend = new UnavailableBackend();
    const runtime = composeSharingRuntime({
      available: false,
      householdBackend: backend,
      syncBackend: backend,
      settings: new InMemorySettingsRepository(),
      store: new InMemorySyncStore(),
      stores: {
        pantry_items: createPantryEntityStore(new InMemoryPantryRepository()),
        meal_plan_entries: createMealPlanEntityStore(new InMemoryMealPlanRepository()),
        shopping_items: createShoppingEntityStore(new InMemoryShoppingChecksRepository()),
      },
    });
    await runtime.start();
    return runtime;
  })();

  return instance;
}
