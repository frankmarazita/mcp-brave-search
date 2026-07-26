import { describe, expect, test } from "bun:test";
import { createRateLimiter, RateLimitError } from "../src/rate-limit";

describe("createRateLimiter", () => {
  test("lets the first request through immediately", async () => {
    const limiter = createRateLimiter({ perSecond: 1, perMonth: 10 });
    const start = Date.now();

    await limiter.acquire();

    expect(Date.now() - start).toBeLessThan(50);
  });

  test("spaces queued requests by the per-second interval", async () => {
    const limiter = createRateLimiter({ perSecond: 50, perMonth: 10 });
    const timestamps: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, async () => {
        await limiter.acquire();
        timestamps.push(Date.now());
      })
    );

    expect(timestamps).toHaveLength(4);
    expect(timestamps[3]! - timestamps[0]!).toBeGreaterThanOrEqual(55);
  });

  test("scales the interval by the safety margin", async () => {
    const limiter = createRateLimiter({
      perSecond: 50,
      perMonth: 10,
      marginFactor: 3,
    });
    const start = Date.now();

    await limiter.acquire();
    await limiter.acquire();

    expect(Date.now() - start).toBeGreaterThanOrEqual(55);
  });

  test("keeps the margin proportional as the allowance rises", async () => {
    const limiter = createRateLimiter({
      perSecond: 200,
      perMonth: 10,
      marginFactor: 2,
    });
    const start = Date.now();

    await limiter.acquire();
    await limiter.acquire();

    expect(Date.now() - start).toBeLessThan(50);
  });

  test("throws once the monthly quota is exhausted", async () => {
    const limiter = createRateLimiter({ perSecond: 1000, perMonth: 2 });

    await limiter.acquire();
    await limiter.acquire();

    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitError);
  });

  test("resets the monthly quota when the UTC month rolls over", async () => {
    let now = Date.UTC(2026, 0, 31, 23, 59, 59);
    const limiter = createRateLimiter({
      perSecond: 1000,
      perMonth: 1,
      now: () => now,
    });

    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitError);

    now = Date.UTC(2026, 1, 1, 0, 0, 0);
    await expect(limiter.acquire()).resolves.toBeUndefined();
  });
});
