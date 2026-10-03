import type { LimiterFactory, RateLimitLimiter, RateLimitRule } from "@/lib/platform/rate-limit";

// In-memory stand-in for `@upstash/ratelimit`'s sliding window
// (docs/specs/core-integrations.md, INT-5). `@upstash/ratelimit`'s Lua
// scripts carry an Upstash-only Redis flag that a local OSS Redis rejects
// (docs/decisions/0017-upstash-qstash-react-email.md), so
// `server/rate-limit/service.integration.test.ts` injects this through
// `lib/platform/rate-limit.ts`'s `limiterFactory` instead of reaching a real
// or local Redis at all.

interface Counter {
  count: number;
  windowStart: number;
}

/**
 * A fake Ratelimit backed by one shared in-memory store, so a
 * `resetUsedTokens` call made through a *different* rule shape — exactly
 * what `lib/platform/rate-limit.ts`'s `reset()` always does, via its own
 * fixed 1-request/1s `RESET_RULE` — still clears the same key, the same way
 * resetting through any real `Ratelimit` instance clears the same physical
 * Redis key regardless of which rule wrote it.
 *
 * `now` defaults to the real clock; a test that needs to move the window
 * forward deterministically can inject its own.
 */
export function createRatelimitFake(now: () => number = () => Date.now()) {
  const store = new Map<string, Counter>();
  const limiters = new Map<string, RateLimitLimiter>();

  function limiterFor(rule: RateLimitRule): RateLimitLimiter {
    const cacheKey = `${rule.limit}:${rule.windowMs}`;
    const cached = limiters.get(cacheKey);
    if (cached) return cached;

    const limiter: RateLimitLimiter = {
      async limit(identifier) {
        const current = now();
        const existing = store.get(identifier);
        const windowStart =
          existing && current - existing.windowStart < rule.windowMs
            ? existing.windowStart
            : current;
        const count = (existing && existing.windowStart === windowStart ? existing.count : 0) + 1;
        store.set(identifier, { count, windowStart });

        return {
          success: count <= rule.limit,
          remaining: Math.max(0, rule.limit - count),
          reset: windowStart + rule.windowMs,
        };
      },
      async getRemaining(identifier) {
        const current = now();
        const existing = store.get(identifier);
        if (!existing || current - existing.windowStart >= rule.windowMs) {
          return { remaining: rule.limit, reset: current + rule.windowMs };
        }
        return {
          remaining: Math.max(0, rule.limit - existing.count),
          reset: existing.windowStart + rule.windowMs,
        };
      },
      async resetUsedTokens(identifier) {
        store.delete(identifier);
      },
    };
    limiters.set(cacheKey, limiter);
    return limiter;
  }

  const factory: LimiterFactory = (rule) => limiterFor(rule);

  return { factory, limiterFor };
}
