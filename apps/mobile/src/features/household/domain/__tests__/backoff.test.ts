import { backoffDelayMs } from '../backoff';

describe('backoffDelayMs', () => {
  it('grows exponentially with the attempt number', () => {
    const max = () => 1; // full delay, no jitter reduction

    expect(backoffDelayMs(1, max)).toBe(2_000);
    expect(backoffDelayMs(2, max)).toBe(4_000);
    expect(backoffDelayMs(3, max)).toBe(8_000);
  });

  it('never exceeds the cap', () => {
    expect(backoffDelayMs(30, () => 1)).toBe(300_000);
  });

  it('applies jitter between half and the full delay', () => {
    expect(backoffDelayMs(3, () => 0)).toBe(4_000);
    expect(backoffDelayMs(3, () => 0.5)).toBe(6_000);
  });

  it('treats an attempt below one as the first', () => {
    expect(backoffDelayMs(0, () => 1)).toBe(2_000);
  });
});
