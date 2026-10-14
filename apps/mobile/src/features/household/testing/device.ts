import { InMemoryMealPlanRepository } from '@/features/meal-plan/infrastructure/in-memory-meal-plan-repository';
import { SyncedMealPlanRepository } from '@/features/meal-plan/infrastructure/synced-meal-plan-repository';
import { createIngredient } from '@/features/pantry/domain/ingredient';
import { createPantryItem } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { makeQuantity } from '@/features/pantry/domain/quantity';
import { InMemoryPantryRepository } from '@/features/pantry/infrastructure/in-memory-pantry-repository';
import { SyncedPantryRepository } from '@/features/pantry/infrastructure/synced-pantry-repository';
import { InMemoryShoppingChecksRepository } from '@/features/shopping-list/infrastructure/in-memory-shopping-checks-repository';
import { SyncedShoppingChecksRepository } from '@/features/shopping-list/infrastructure/synced-shopping-checks-repository';
import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';
import { InMemorySyncStore } from '@/shared/sync/in-memory-sync-store';
import { soloRecorder, type SyncRecorder } from '@/shared/sync/sync-recorder';

import { composeSharingRuntime, type SharingRuntime } from '../application/compose-sharing-runtime';
import type { Scheduler } from '../application/sync-engine';
import {
  createMealPlanEntityStore,
  createPantryEntityStore,
  createShoppingEntityStore,
} from '../infrastructure/entity-stores';

import { FakeBackend, type FakeServer } from './fake-server';

/** A scheduler that only runs tasks when the test says so. */
export function manualScheduler() {
  const tasks: { task: () => void; delayMs: number }[] = [];

  const schedule: Scheduler = (task, delayMs) => {
    const entry = { task, delayMs };
    tasks.push(entry);
    return () => {
      const index = tasks.indexOf(entry);
      if (index !== -1) tasks.splice(index, 1);
    };
  };

  return {
    schedule,
    delays: () => tasks.map((entry) => entry.delayMs),
    /** Runs everything that is due and lets the work it starts finish. */
    async runAll() {
      const due = tasks.splice(0, tasks.length);
      for (const entry of due) entry.task();
      await settle();
    },
  };
}

/** Lets promise chains started with `void` run to completion. */
export async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

export function pantryEntry(name: string, amount = 1): PantryEntry {
  return {
    ingredient: createIngredient({
      id: name.toLowerCase(),
      name,
      category: 'produce',
      defaultUnit: 'unit',
    }),
    item: createPantryItem({
      ingredientId: name.toLowerCase(),
      quantity: makeQuantity(amount, 'unit'),
      lowStockThreshold: null,
    }),
  };
}

export async function pantryAmounts(device: Device): Promise<Record<string, number>> {
  const entries = await device.pantry.findAll();
  return Object.fromEntries(entries.map((e) => [e.ingredient.id, e.item.quantity.amount]));
}

/**
 * One phone: its own database, its own queue, its own connection to the fake
 * server. `pantry`, `plan` and `ticks` are what the screens use (decorated);
 * the `raw*` ones are the tables underneath.
 */
export function createDevice(
  server: FakeServer,
  userId: string,
  options: { available?: boolean } = {},
) {
  const backend = new FakeBackend(server, userId);
  const settings = new InMemorySettingsRepository();
  const store = new InMemorySyncStore();
  return assembleDevice({ server, backend, settings, store, ...options });
}

export type Device = ReturnType<typeof assembleDevice>;

/** The app restarting: same database and settings, fresh in-memory runtime. */
export function restartDevice(device: Device): Device {
  return assembleDevice({
    server: device.server,
    backend: device.backend,
    settings: device.settings,
    store: device.store,
    available: device.available,
    rawPantry: device.rawPantry,
    rawPlan: device.rawPlan,
    rawTicks: device.rawTicks,
  });
}

type DeviceParts = {
  server: FakeServer;
  backend: FakeBackend;
  settings: InMemorySettingsRepository;
  store: InMemorySyncStore;
  available?: boolean;
  rawPantry?: InMemoryPantryRepository;
  rawPlan?: InMemoryMealPlanRepository;
  rawTicks?: InMemoryShoppingChecksRepository;
};

function assembleDevice(parts: DeviceParts) {
  const { backend, settings, store } = parts;
  const rawPantry = parts.rawPantry ?? new InMemoryPantryRepository();
  const rawPlan = parts.rawPlan ?? new InMemoryMealPlanRepository();
  const rawTicks = parts.rawTicks ?? new InMemoryShoppingChecksRepository();
  const scheduler = manualScheduler();

  let recorder: SyncRecorder = soloRecorder;
  const runtime: SharingRuntime = composeSharingRuntime({
    available: parts.available ?? true,
    householdBackend: backend,
    syncBackend: backend,
    settings,
    store,
    stores: {
      pantry_items: createPantryEntityStore(rawPantry),
      meal_plan_entries: createMealPlanEntityStore(rawPlan),
      shopping_items: createShoppingEntityStore(rawTicks),
    },
    scheduler: scheduler.schedule,
    random: () => 1,
    now: () => new Date('2026-10-12T12:00:00.000Z'),
    installRecorder: (installed) => {
      recorder = installed;
    },
  });

  const current = () => recorder;
  return {
    ...parts,
    runtime,
    service: runtime.service,
    engine: runtime.engine,
    scheduler,
    rawPantry,
    rawPlan,
    rawTicks,
    pantry: new SyncedPantryRepository(rawPantry, current),
    plan: new SyncedMealPlanRepository(rawPlan, current),
    ticks: new SyncedShoppingChecksRepository(rawTicks, current),
    /** Runs one full cycle and lets any follow-up work finish. */
    async sync() {
      await runtime.engine.syncNow();
      await settle();
    },
  };
}
