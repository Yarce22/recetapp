import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

import { SharingError } from '../../domain/household';
import { SupabaseAuthStorage } from '../supabase-auth-storage';
import { toSharingError } from '../supabase-errors';

describe('toSharingError', () => {
  it.each([
    [
      'row level security',
      { code: '42501', message: 'new row violates row-level security' },
      'forbidden',
    ],
    ['an expired token', { code: 'PGRST301', message: 'JWT expired' }, 'auth'],
    ['an unauthenticated call', { code: '28000', message: 'not_authenticated' }, 'auth'],
    ['a 401', { status: 401, message: 'Unauthorized' }, 'auth'],
    ['a check constraint', { code: '23514', message: 'violates check constraint' }, 'rejected'],
    ['an rpc refusal', { code: 'P0001', message: 'already_in_household' }, 'rejected'],
    ['a bad value', { code: '22P02', message: 'invalid input syntax' }, 'rejected'],
    ['a server error', { status: 503, message: 'unavailable' }, 'server'],
    ['a failed fetch', { message: 'TypeError: Network request failed' }, 'offline'],
    ['a retryable auth fetch', { name: 'AuthRetryableFetchError', message: 'x' }, 'offline'],
    ['something unknown', { message: 'weird' }, 'server'],
  ])('maps %s', (_label, error, kind) => {
    expect(toSharingError(error).kind).toBe(kind);
  });

  it('passes a SharingError through untouched', () => {
    const original = new SharingError('offline', 'x');

    expect(toSharingError(original)).toBe(original);
  });

  it('copes with a value that is not an object', () => {
    expect(toSharingError(undefined).kind).toBe('server');
  });
});

describe('SupabaseAuthStorage', () => {
  it('round-trips a session through the settings table under its own prefix', async () => {
    const settings = new InMemorySettingsRepository();
    const storage = new SupabaseAuthStorage(settings);

    await storage.setItem('sb-token', '{"a":1}');

    expect(await storage.getItem('sb-token')).toBe('{"a":1}');
    expect(await settings.get('sb-token')).toBeNull();
  });

  it('treats a removed item as absent', async () => {
    const storage = new SupabaseAuthStorage(new InMemorySettingsRepository());
    await storage.setItem('k', 'v');

    await storage.removeItem('k');

    expect(await storage.getItem('k')).toBeNull();
  });
});
