/** What the server says about one record. */
export type RemoteVersion = {
  /** Server-assigned instant of the last write, as an ISO string. */
  updatedAt: string;
  /** True when the record is a tombstone. */
  deleted: boolean;
};

/** What this device knows about the same record. */
export type LocalState = {
  /** True while an unpushed local change exists for the record. */
  dirty: boolean;
  /** The last server version merged into the device, or null if never seen. */
  meta: RemoteVersion | null;
};

export type MergeDecision = 'apply' | 'delete' | 'ignore';

const INSTANT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Microseconds since epoch, or NaN when the string is not a readable instant.
 *
 * Postgres timestamps carry microseconds and `Date.parse` drops them. Two
 * writes to one record less than a millisecond apart would then compare equal,
 * and the later one would be ignored as an echo.
 */
export function toMicros(value: string): number {
  const match = INSTANT.exec(value);
  if (!match) return Number.NaN;

  const [, day, time, fraction = '', zone] = match;
  const offset =
    zone === 'Z'
      ? 'Z'
      : zone.length === 3
        ? `${zone}:00`
        : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const seconds = Date.parse(`${day}T${time}${offset}`);
  if (Number.isNaN(seconds)) return Number.NaN;

  return seconds * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

/**
 * Compares two ISO instants by the moment they denote, not by their text:
 * `...+00:00` and `...Z` are the same instant and must compare equal.
 */
export function compareTimestamps(a: string, b: string): number {
  return toMicros(a) - toMicros(b);
}

/** True when `remote` is strictly newer than the last version merged. */
export function isNewerThanMeta(remote: RemoteVersion, meta: RemoteVersion | null): boolean {
  if (Number.isNaN(toMicros(remote.updatedAt))) return false;
  return meta === null || compareTimestamps(remote.updatedAt, meta.updatedAt) > 0;
}

/**
 * Last-write-wins for one record, using the server's clock only.
 *
 * Rules, in order:
 * 1. A local change that has not been pushed yet always wins on this device. It
 *    will reach the server later and, being the last write to arrive, win there
 *    too. Dropping it here would silently lose an offline edit.
 * 2. A remote version that is not newer than the last one merged is an echo or
 *    a stale read and is ignored. This is what stops an older live version from
 *    resurrecting a record whose tombstone was already merged.
 * 3. A newer tombstone deletes, a newer live version applies (and revives).
 */
export function decideMerge(remote: RemoteVersion, local: LocalState): MergeDecision {
  if (Number.isNaN(toMicros(remote.updatedAt))) return 'ignore';
  if (local.dirty) return 'ignore';

  if (!isNewerThanMeta(remote, local.meta)) return 'ignore';

  return remote.deleted ? 'delete' : 'apply';
}
