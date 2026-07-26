export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface RateLimiterOptions {
  perSecond: number;
  perMonth: number;
  marginFactor?: number;
  now?: () => number;
}

function monthlyWindowOf(timestamp: number) {
  const date = new Date(timestamp);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Callers are queued rather than rejected so a burst of requests is spread
// across the per-second allowance instead of failing. The monthly quota is
// held in memory, so it resets whenever the process restarts.
//
// Spacing is measured when a slot is granted, but Brave enforces on arrival in
// fixed one-second buckets, so pacing at exactly the allowance lets network
// jitter drop two requests into the same bucket. marginFactor buys the
// headroom, and scales with the allowance so raising perSecond still speeds
// things up.
export function createRateLimiter({
  perSecond,
  perMonth,
  marginFactor = 1,
  now = Date.now,
}: RateLimiterOptions) {
  const minIntervalMs = (1000 / perSecond) * marginFactor;

  let queue: Promise<void> = Promise.resolve();
  let lastAcquiredAt = 0;
  let monthlyCount = 0;
  let monthlyWindow = monthlyWindowOf(now());

  return {
    async acquire() {
      const window = monthlyWindowOf(now());

      if (window !== monthlyWindow) {
        monthlyWindow = window;
        monthlyCount = 0;
      }

      if (monthlyCount >= perMonth) {
        throw new RateLimitError(
          `Monthly quota of ${perMonth} requests exhausted`
        );
      }

      monthlyCount++;

      const slot = queue.then(async () => {
        const wait = lastAcquiredAt + minIntervalMs - now();
        if (wait > 0) await sleep(wait);
        lastAcquiredAt = now();
      });

      queue = slot;

      await slot;
    },
  };
}
