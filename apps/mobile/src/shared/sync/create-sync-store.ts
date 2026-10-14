import { getDatabase } from '@/shared/db/client';

import { SqliteSyncStore } from './sqlite-sync-store';
import type { SyncStore } from './sync-store';

/** Native: the sync bookkeeping shares the app's SQLite database. */
export async function createSyncStore(): Promise<SyncStore> {
  return new SqliteSyncStore(await getDatabase());
}
