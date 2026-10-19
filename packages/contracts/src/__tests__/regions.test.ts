import { DEFAULT_REGION, REGIONS, isRegion } from '../regions.ts';

describe('regions', () => {
  it('defaults to Colombia', () => {
    expect(DEFAULT_REGION).toBe('CO');
  });

  it('lists the default region', () => {
    expect(REGIONS).toContain(DEFAULT_REGION);
  });

  it('recognises supported regions only', () => {
    expect(isRegion('CO')).toBe(true);
    expect(isRegion('co')).toBe(false);
    expect(isRegion('ZZ')).toBe(false);
    expect(isRegion(undefined)).toBe(false);
  });
});
