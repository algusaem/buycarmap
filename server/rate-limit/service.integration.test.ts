import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "./service";

const RULE = { limit: 5, windowMs: 60_000 };

beforeEach(async () => {
  await prisma.rateLimit.deleteMany();
});

// `prisma` is the real client here (unlike the mocked version this replaced),
// so `vi.spyOn(prisma, "$queryRaw")` below wraps the real method in place
// rather than swapping in a fresh `vi.fn()` each test. Left unrestored, a
// later test's `vi.spyOn` call reuses that same spy and inherits its call
// history from whichever earlier test installed it.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("consumeRateLimit", () => {
  it("allows a request at the limit and reports no remaining budget", async () => {
    // The 5th of 5 must still go through; only the 6th is refused.
    for (let n = 0; n < 4; n++) await consumeRateLimit("k", RULE);

    expect(await consumeRateLimit("k", RULE)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });
  });

  it("refuses the request past the limit and reports the wait", async () => {
    for (let n = 0; n < 6; n++) await consumeRateLimit("k", RULE);

    const result = await consumeRateLimit("k", RULE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Rounded comparison: the clock moves between the writes and the assertion.
    expect(result.retryAfterMs).toBeGreaterThan(55_000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("reports the remaining budget mid-window", async () => {
    await consumeRateLimit("k", RULE);

    expect((await consumeRateLimit("k", RULE)).remaining).toBe(3);
  });

  it("never reports a negative wait for an already-expired window", async () => {
    // Insert an already-expired row directly, rather than waiting for the
    // window to elapse.
    await prisma.rateLimit.create({
      data: { key: "k", count: 99, expiresAt: new Date(Date.now() - 10_000) },
    });

    expect((await consumeRateLimit("k", RULE)).retryAfterMs).toBe(0);
  });

  it("fails open when the database is unavailable", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection lost"));

    // A limiter that hard-fails on a database hiccup turns a transient outage
    // into a total auth outage.
    expect(await consumeRateLimit("k", RULE)).toEqual({
      allowed: true,
      remaining: RULE.limit,
      retryAfterMs: 0,
    });
  });

  it("counts and rolls the window in a single statement", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw");

    await consumeRateLimit("k", RULE);

    // A read-then-write would let two concurrent attempts both observe the old
    // count and slip past the limit, so this must be one round-trip.
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("isRateLimited", () => {
  it("is false when no counter exists", async () => {
    expect(await isRateLimited("k", RULE)).toBe(false);
  });

  it("is true at or past the limit inside the window", async () => {
    for (let n = 0; n < 5; n++) await consumeRateLimit("k", RULE);

    expect(await isRateLimited("k", RULE)).toBe(true);
  });

  it("is false once the window has expired, however high the count", async () => {
    await prisma.rateLimit.create({
      data: { key: "k", count: 500, expiresAt: new Date(Date.now() - 1) },
    });

    // Otherwise a lockout would never lift.
    expect(await isRateLimited("k", RULE)).toBe(false);
  });

  it("does not consume budget", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw");

    await isRateLimited("k", RULE);

    // A locked-out account must not extend its own lockout just by being
    // checked.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("resetRateLimit", () => {
  it("clears an existing counter", async () => {
    await consumeRateLimit("k", RULE);

    await resetRateLimit("k");

    expect(await prisma.rateLimit.findUnique({ where: { key: "k" } })).toBeNull();
  });

  it("swallows a database failure", async () => {
    vi.spyOn(prisma.rateLimit, "deleteMany").mockRejectedValueOnce(new Error("connection lost"));

    // Best effort: a stale counter expires on its own, and throwing here would
    // fail an otherwise successful sign-in.
    await expect(resetRateLimit("k")).resolves.toBeUndefined();
  });
});
