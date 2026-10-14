import { getSharingConfig, isSharingAvailable } from '../sharing';

describe('sharing configuration', () => {
  it('is available when both variables are set', () => {
    const env = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' };

    expect(isSharingAvailable(env)).toBe(true);
    expect(getSharingConfig(env)).toEqual({
      url: 'https://abc.supabase.co',
      key: 'sb_publishable_x',
    });
  });

  it.each([
    ['both missing', { url: undefined, key: undefined }],
    ['the url missing', { url: undefined, key: 'sb_publishable_x' }],
    ['the key missing', { url: 'https://abc.supabase.co', key: undefined }],
    ['the key blank', { url: 'https://abc.supabase.co', key: '   ' }],
    ['the url blank', { url: '', key: 'sb_publishable_x' }],
  ])('is disabled with %s', (_label, env) => {
    expect(isSharingAvailable(env)).toBe(false);
    expect(getSharingConfig(env)).toBeNull();
  });

  it('refuses a url that is not https (except a local dev server)', () => {
    expect(isSharingAvailable({ url: 'http://abc.supabase.co', key: 'k' })).toBe(false);
    expect(isSharingAvailable({ url: 'not a url', key: 'k' })).toBe(false);
    expect(isSharingAvailable({ url: 'http://localhost:54321', key: 'k' })).toBe(true);
  });

  it('drops trailing slashes and surrounding spaces', () => {
    expect(getSharingConfig({ url: ' https://abc.supabase.co/ ', key: ' k ' })).toEqual({
      url: 'https://abc.supabase.co',
      key: 'k',
    });
  });

  it('is disabled in the test environment, where nothing is configured', () => {
    expect(isSharingAvailable()).toBe(false);
  });
});
