import { createRateLimiter } from '../rate-limit.ts';

const HOUR = 60 * 60 * 1000;

function setup(overrides: Partial<Parameters<typeof createRateLimiter>[0]> = {}) {
  let now = 0;
  const limiter = createRateLimiter({
    perDevicePerHour: 3,
    globalPerHour: 5,
    now: () => now,
    ...overrides,
  });
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe('rate limiter', () => {
  it('allows requests under the device limit', () => {
    const { limiter } = setup();

    expect(limiter.check('device-a').allowed).toBe(true);
    expect(limiter.check('device-a').allowed).toBe(true);
    expect(limiter.check('device-a').allowed).toBe(true);
  });

  it('blocks a device once it exceeds its own allowance', () => {
    const { limiter } = setup();

    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');

    const fourth = limiter.check('device-a');
    expect(fourth.allowed).toBe(false);
    expect(fourth.reason).toBe('device');
  });

  it('keeps devices independent of each other', () => {
    const { limiter } = setup();

    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');

    expect(limiter.check('device-b').allowed).toBe(true);
  });

  it('blocks everyone once the global budget is spent, even a fresh device', () => {
    const { limiter } = setup();

    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-b');
    limiter.check('device-b');

    const blocked = limiter.check('device-c');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('global');
  });

  it('lets a blocked device through again once its window has passed', () => {
    const { limiter, advance } = setup();

    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');
    expect(limiter.check('device-a').allowed).toBe(false);

    advance(HOUR + 1);
    expect(limiter.check('device-a').allowed).toBe(true);
  });

  it('reports how long to wait before retrying', () => {
    const { limiter, advance } = setup();

    limiter.check('device-a');
    advance(10 * 60 * 1000);
    limiter.check('device-a');
    limiter.check('device-a');

    const blocked = limiter.check('device-a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it('does not count blocked requests against the budget', () => {
    const { limiter, advance } = setup();

    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');
    limiter.check('device-a');

    // Only the three allowed calls consumed the global budget, so two other
    // devices can still be served.
    expect(limiter.check('device-b').allowed).toBe(true);
    expect(limiter.check('device-c').allowed).toBe(true);
    advance(0);
    expect(limiter.check('device-d').allowed).toBe(false);
  });
});
