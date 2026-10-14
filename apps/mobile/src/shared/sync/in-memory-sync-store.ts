import type { SyncEntityName } from './sync-entities';
import type { OutboxEntry, OutboxOp, RecordMeta, SyncStore } from './sync-store';

const id = (entity: SyncEntityName, key: string) => `${entity}#${key}`;

/** In-memory store: used by the web build and by tests. */
export class InMemorySyncStore implements SyncStore {
  private readonly outbox = new Map<string, OutboxEntry>();
  private readonly meta = new Map<string, RecordMeta>();
  private readonly state = new Map<string, string>();
  private revision = 0;

  async enqueue(
    entity: SyncEntityName,
    key: string,
    op: OutboxOp,
    row: Record<string, unknown>,
  ): Promise<void> {
    this.revision += 1;
    this.outbox.set(id(entity, key), { entity, key, op, row, rev: this.revision });
  }

  async pending(limit: number): Promise<OutboxEntry[]> {
    return [...this.outbox.values()].sort((a, b) => a.rev - b.rev).slice(0, limit);
  }

  async pendingCount(): Promise<number> {
    return this.outbox.size;
  }

  async isDirty(entity: SyncEntityName, key: string): Promise<boolean> {
    return this.outbox.has(id(entity, key));
  }

  async acknowledge(entity: SyncEntityName, key: string, rev: number): Promise<void> {
    if (this.outbox.get(id(entity, key))?.rev === rev) this.outbox.delete(id(entity, key));
  }

  async getMeta(entity: SyncEntityName, key: string): Promise<RecordMeta | null> {
    return this.meta.get(id(entity, key)) ?? null;
  }

  async setMeta(entity: SyncEntityName, key: string, meta: RecordMeta): Promise<void> {
    this.meta.set(id(entity, key), meta);
  }

  async getState(name: string): Promise<string | null> {
    return this.state.get(name) ?? null;
  }

  async setState(name: string, value: string | null): Promise<void> {
    if (value === null) this.state.delete(name);
    else this.state.set(name, value);
  }

  async reset(): Promise<void> {
    this.outbox.clear();
    this.meta.clear();
    this.state.clear();
  }
}
