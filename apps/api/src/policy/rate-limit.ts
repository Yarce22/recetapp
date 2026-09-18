const HOUR_MS = 60 * 60 * 1000;

export type RateLimitDecision = {
  allowed: boolean;
  /** Which budget ran out. Absent when the request was allowed. */
  reason?: 'device' | 'global';
  retryAfterSeconds?: number;
};

export type RateLimiter = {
  check(deviceId: string): RateLimitDecision;
};

export type RateLimiterOptions = {
  perDevicePerHour: number;
  globalPerHour: number;
  /** Injectable clock, so the window behaviour is testable without waiting. */
  now?: () => number;
};

/**
 * Sliding-window rate limiter over a one hour window.
 *
 * Two budgets, because they protect against different things: the per-device
 * budget stops one client from monopolising the service, and the global budget
 * caps what the whole service can cost in an hour no matter how many clients
 * show up.
 *
 * The MVP has no accounts, so "device" is a client-supplied identifier. That
 * is weaker than an authenticated quota - a determined caller can rotate it -
 * which is precisely why the global budget exists behind it.
 *
 * State lives in process memory: it does not survive a restart and is not
 * shared across instances. Adequate for a single-instance MVP; a shared store
 * is the replacement once there is more than one.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const perDevice = new Map<string, number[]>();
  let globalHits: number[] = [];

  const withinWindow = (timestamps: number[], at: number) =>
    timestamps.filter((timestamp) => at - timestamp < HOUR_MS);

  const retryAfter = (timestamps: number[], at: number) => {
    const oldest = Math.min(...timestamps);
    return Math.max(1, Math.ceil((HOUR_MS - (at - oldest)) / 1000));
  };

  return {
    check(deviceId: string): RateLimitDecision {
      const at = now();

      const deviceHits = withinWindow(perDevice.get(deviceId) ?? [], at);
      if (deviceHits.length >= options.perDevicePerHour) {
        perDevice.set(deviceId, deviceHits);
        return { allowed: false, reason: 'device', retryAfterSeconds: retryAfter(deviceHits, at) };
      }

      globalHits = withinWindow(globalHits, at);
      if (globalHits.length >= options.globalPerHour) {
        return { allowed: false, reason: 'global', retryAfterSeconds: retryAfter(globalHits, at) };
      }

      // Only requests that are actually served consume budget. Charging for
      // rejected calls would let a client exhaust the global budget purely by
      // hammering a door that is already closed.
      deviceHits.push(at);
      globalHits.push(at);
      perDevice.set(deviceId, deviceHits);

      return { allowed: true };
    },
  };
}
