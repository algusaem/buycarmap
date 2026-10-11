import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRatelimitFake } from "@/test/fakes/ratelimit";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "./service";

const RULE = { name: "test-rule", limit: 5, windowMs: 60_000 };

// INT-5 (docs/specs/core-integrations.md): there is no local Upstash-compatible
// Redis any more (@upstash/ratelimit's Lua scripts carry an Upstash-only
// Redis flag OSS Redis rejects, docs/decisions/0017-upstash-qstash-react-email.md),
// so the tests below that exercise the real sliding-window math inject this
// in-memory fake through `consumeRateLimit`/`isRateLimited`/`resetRateLimit`'s
// `limiterFactory` parameter instead. One fake for the whole file —
// `lib/platform/rate-limit.ts` caches one limiter per rule shape for the
// life of the module, so a fresh fake per test would not be seen.
const fake = createRatelimitFake();

beforeEach(async () => {
  // Clears "k" for every rule shape sharing the fake's store, the same way
  // resetting through any real Ratelimit instance clears the same physical
  // Redis key regardless of which rule wrote it.
  await resetRateLimit("k", fake.factory);
});

// `vi.spyOn(limiter, "limit")` below wraps the fake's cached limiter in place.
// Left unrestored, a later test's `vi.spyOn` call reuses that same spy and
// inherits its call history from whichever earlier test installed it.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("consumeRateLimit", () => {
  it("allows a request at the limit and reports no remaining budget", async () => {
    // The 5th of 5 must still go through; only the 6th is refused.
    for (let n = 0; n < 4; n++) await consumeRateLimit("k", RULE, fake.factory);

    expect(await consumeRateLimit("k", RULE, fake.factory)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });
  });

  it("refuses the request past the limit and reports the wait", async () => {
    for (let n = 0; n < 6; n++) await consumeRateLimit("k", RULE, fake.factory);

    const result = await consumeRateLimit("k", RULE, fake.factory);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Rounded comparison: the clock moves between the writes and the assertion.
    expect(result.retryAfterMs).toBeGreaterThan(55_000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("reports the remaining budget mid-window", async () => {
    await consumeRateLimit("k", RULE, fake.factory);

    expect((await consumeRateLimit("k", RULE, fake.factory)).remaining).toBe(3);
  });

  it("counts and rolls the window in a single statement", async () => {
    const limiter = fake.limiterFor(RULE);
    const limitSpy = vi.spyOn(limiter, "limit");

    await consumeRateLimit("k", RULE, fake.factory);

    // A read-then-write would let two concurrent attempts both observe the old
    // count and slip past the limit, so this must be one round-trip to the
    // rate-limit store.
    expect(limitSpy).toHaveBeenCalledOnce();
  });
});

describe("isRateLimited", () => {
  it("is false when no counter exists", async () => {
    expect(await isRateLimited("k", RULE)).toBe(false);
  });

  it("is true at or past the limit inside the window", async () => {
    for (let n = 0; n < 5; n++) await consumeRateLimit("k", RULE, fake.factory);

    expect(await isRateLimited("k", RULE, fake.factory)).toBe(true);
  });
});
