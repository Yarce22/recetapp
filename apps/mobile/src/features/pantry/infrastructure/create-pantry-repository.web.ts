import type { PantryRepository } from '../domain/pantry-repository';

import { InMemoryPantryRepository } from './in-memory-pantry-repository';

/**
 * Builds the pantry repository for web: in memory, not persisted.
 *
 * expo-sqlite runs on web through a WebAssembly build that ships as a web
 * worker. Expo's chunk serializer could not produce a standalone chunk for
 * that worker in this project, which broke every web bundle
 * ("Worker chunk not found for: expo-sqlite/web/worker.ts").
 *
 * Rather than fight the bundler, the port is satisfied with a different
 * adapter. Web is a development convenience here - the product ships to the
 * App Store and Play Store - so losing persistence there costs nothing real,
 * and native keeps its SQLite storage untouched.
 *
 * Reloading the page starts from an empty pantry. When web becomes a target
 * worth persisting, the replacement is an IndexedDB adapter behind this same
 * function, and no feature code changes.
 */
export async function createPantryRepository(): Promise<PantryRepository> {
  return new InMemoryPantryRepository();
}
