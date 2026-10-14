import { decodeKey, encodeKey, keyOfRow, keyToColumns } from '../sync-entities';

describe('sync entity keys', () => {
  it('round-trips a key made of several parts', () => {
    const key = encodeKey(['2026-10-12', 'dinner']);

    expect(decodeKey(key)).toEqual(['2026-10-12', 'dinner']);
  });

  it('keeps a part that contains separators intact', () => {
    const key = encodeKey(['a|b', 'c"d']);

    expect(decodeKey(key)).toEqual(['a|b', 'c"d']);
  });

  it('builds the key of a pantry row from its key column', () => {
    expect(keyOfRow('pantry_items', { ingredient_id: 'tomato', amount: 3 })).toBe(
      encodeKey(['tomato']),
    );
  });

  it('builds the key of a meal plan row from date and slot', () => {
    expect(keyOfRow('meal_plan_entries', { date: '2026-10-12', slot: 'dinner' })).toBe(
      encodeKey(['2026-10-12', 'dinner']),
    );
  });

  it('maps a key back to its column values', () => {
    expect(keyToColumns('meal_plan_entries', encodeKey(['2026-10-12', 'lunch']))).toEqual({
      date: '2026-10-12',
      slot: 'lunch',
    });
  });

  it('rejects a key with the wrong number of parts', () => {
    expect(() => keyToColumns('meal_plan_entries', encodeKey(['only-one']))).toThrow();
  });

  it('rejects a row that lacks a key column', () => {
    expect(() => keyOfRow('meal_plan_entries', { date: '2026-10-12' })).toThrow();
  });
});
