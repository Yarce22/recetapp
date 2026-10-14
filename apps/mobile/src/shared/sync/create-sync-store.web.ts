import { InMemorySyncStore } from './in-memory-sync-store';
import type { SyncStore } from './sync-store';

/** Web keeps everything in memory, so there is nothing durable to queue. */
export async function createSyncStore(): Promise<SyncStore> {
  return new InMemorySyncStore();
}
