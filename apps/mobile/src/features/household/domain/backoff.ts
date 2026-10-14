const BASE_MS = 2_000;
const CAP_MS = 300_000;

/**
 * Delay before retry number `attempt` (1 for the first retry).
 *
 * Exponential from 2 s up to a 5 minute cap, with jitter between half and the
 * full delay so that several phones that lost the network together do not all
 * come back on the same tick. `random` is injectable so tests are exact.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const step = Math.max(1, Math.floor(attempt)) - 1;
  const delay = Math.min(CAP_MS, BASE_MS * 2 ** Math.min(step, 20));
  return Math.round(delay * (0.5 + 0.5 * random()));
}
