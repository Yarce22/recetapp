import { type MigrationDb, type Migration, runMigrations } from '@/shared/db/migrations';

function fakeDb(startingVersion = 0) {
  const executed: string[] = [];
  let version = startingVersion;

  const db: MigrationDb = {
    async execAsync(source: string) {
      executed.push(source);
      const match = /PRAGMA user_version = (\d+)/.exec(source);
      if (match) version = Number(match[1]);
    },
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
  };

  return { db, executed, currentVersion: () => version };
}

const migrations: Migration[] = [
  { version: 1, statements: ['CREATE TABLE a (id TEXT)'] },
  { version: 2, statements: ['CREATE TABLE b (id TEXT)'] },
];

describe('runMigrations', () => {
  it('applies every migration on a fresh database', async () => {
    const { db, executed, currentVersion } = fakeDb(0);

    await runMigrations(db, migrations);

    expect(executed).toContain('CREATE TABLE a (id TEXT)');
    expect(executed).toContain('CREATE TABLE b (id TEXT)');
    expect(currentVersion()).toBe(2);
  });

  it('skips migrations already applied', async () => {
    const { db, executed, currentVersion } = fakeDb(1);

    await runMigrations(db, migrations);

    expect(executed).not.toContain('CREATE TABLE a (id TEXT)');
    expect(executed).toContain('CREATE TABLE b (id TEXT)');
    expect(currentVersion()).toBe(2);
  });

  it('does nothing when the database is already current', async () => {
    const { db, executed, currentVersion } = fakeDb(2);

    await runMigrations(db, migrations);

    expect(executed.filter((s) => s.startsWith('CREATE'))).toEqual([]);
    expect(currentVersion()).toBe(2);
  });

  it('applies migrations in ascending order even if declared out of order', async () => {
    const { db, executed } = fakeDb(0);

    await runMigrations(db, [
      { version: 2, statements: ['SECOND'] },
      { version: 1, statements: ['FIRST'] },
    ]);

    expect(executed.indexOf('FIRST')).toBeLessThan(executed.indexOf('SECOND'));
  });
});
