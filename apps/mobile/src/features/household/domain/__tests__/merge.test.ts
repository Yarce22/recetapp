import { compareTimestamps, decideMerge, toMicros } from '../merge';

const T1 = '2026-10-12T10:00:00.000Z';
const T2 = '2026-10-12T10:00:05.000Z';

describe('compareTimestamps', () => {
  it('orders ISO instants regardless of the offset notation', () => {
    expect(compareTimestamps('2026-10-12T10:00:00.000+00:00', '2026-10-12T10:00:00.000Z')).toBe(0);
    expect(compareTimestamps(T1, T2)).toBeLessThan(0);
    expect(compareTimestamps(T2, T1)).toBeGreaterThan(0);
  });
});

describe('toMicros', () => {
  it('keeps the microseconds Postgres sends', () => {
    expect(
      toMicros('2026-10-12T10:00:00.000002+00:00') - toMicros('2026-10-12T10:00:00.000001Z'),
    ).toBe(1);
  });

  it('reads offsets written without a colon or minutes', () => {
    expect(toMicros('2026-10-12T12:00:00+0200')).toBe(toMicros('2026-10-12T10:00:00Z'));
    expect(toMicros('2026-10-12T12:00:00+02')).toBe(toMicros('2026-10-12T10:00:00Z'));
  });

  it('accepts a space instead of the T', () => {
    expect(toMicros('2026-10-12 10:00:00+00')).toBe(toMicros('2026-10-12T10:00:00Z'));
  });

  it('is NaN for text that is not an instant', () => {
    expect(toMicros('garbage')).toBeNaN();
  });
});

describe('decideMerge', () => {
  it('applies a remote record the device has never seen', () => {
    expect(decideMerge({ updatedAt: T1, deleted: false }, { dirty: false, meta: null })).toBe(
      'apply',
    );
  });

  it('applies a remote record that is newer than the last one merged', () => {
    expect(
      decideMerge(
        { updatedAt: T2, deleted: false },
        { dirty: false, meta: { updatedAt: T1, deleted: false } },
      ),
    ).toBe('apply');
  });

  it('ignores a remote record that is older than or equal to the last one merged', () => {
    const local = { dirty: false, meta: { updatedAt: T2, deleted: false } };

    expect(decideMerge({ updatedAt: T1, deleted: false }, local)).toBe('ignore');
    expect(decideMerge({ updatedAt: T2, deleted: false }, local)).toBe('ignore');
  });

  it('keeps a local change that has not been pushed yet, even against a newer remote', () => {
    expect(
      decideMerge(
        { updatedAt: T2, deleted: false },
        { dirty: true, meta: { updatedAt: T1, deleted: false } },
      ),
    ).toBe('ignore');
  });

  it('deletes locally when the remote record is a newer tombstone', () => {
    expect(
      decideMerge(
        { updatedAt: T2, deleted: true },
        { dirty: false, meta: { updatedAt: T1, deleted: false } },
      ),
    ).toBe('delete');
  });

  it('does not resurrect a record from an older echo of its live version', () => {
    expect(
      decideMerge(
        { updatedAt: T1, deleted: false },
        { dirty: false, meta: { updatedAt: T2, deleted: true } },
      ),
    ).toBe('ignore');
  });

  it('revives a record when a live version is newer than the tombstone', () => {
    expect(
      decideMerge(
        { updatedAt: T2, deleted: false },
        { dirty: false, meta: { updatedAt: T1, deleted: true } },
      ),
    ).toBe('apply');
  });

  it('tells apart two writes less than a millisecond apart', () => {
    expect(
      decideMerge(
        { updatedAt: '2026-10-12T10:00:00.000200+00:00', deleted: false },
        {
          dirty: false,
          meta: { updatedAt: '2026-10-12T10:00:00.000100+00:00', deleted: false },
        },
      ),
    ).toBe('apply');
  });

  it('ignores a record whose timestamp cannot be read', () => {
    expect(
      decideMerge({ updatedAt: 'garbage', deleted: false }, { dirty: false, meta: null }),
    ).toBe('ignore');
  });
});
