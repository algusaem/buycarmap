import { beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ headers: vi.fn(async () => headerStore) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    rateLimit: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
  isRateLimited,
  resetRateLimit,
} from "./rate-limit";

const RULE = { limit: 5, windowMs: 60_000 };

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset();
  vi.mocked(prisma.rateLimit.findUnique).mockReset();
  vi.mocked(prisma.rateLimit.deleteMany).mockReset();
  headerStore.get.mockReset();
});

describe("consumeRateLimit", () => {
  it("allows a request at the limit and reports no remaining budget", async () => {
    // The 5th of 5 must still go through; only the 6th is refused.
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { count: 5, expiresAt: new Date(Date.now() + 30_000) },
    ] as never);

    expect(await consumeRateLimit("k", RULE)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });
  });

  it("refuses the request past the limit and reports the wait", async () => {
    const expiresAt = new Date(Date.now() + 30_000);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { count: 6, expiresAt },
    ] as never);

    const result = await consumeRateLimit("k", RULE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Rounded comparison: the clock moves between the mock and the assertion.
    expect(result.retryAfterMs).toBeGreaterThan(25_000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(30_000);
  });

  it("reports the remaining budget mid-window", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { count: 2, expiresAt: new Date(Date.now() + 30_000) },
    ] as never);

    expect((await consumeRateLimit("k", RULE)).remaining).toBe(3);
  });

  it("never reports a negative wait for an already-expired window", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { count: 99, expiresAt: new Date(Date.now() - 10_000) },
    ] as never);

    expect((await consumeRateLimit("k", RULE)).retryAfterMs).toBe(0);
  });

  it("fails open when the database is unavailable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection lost"));

    // A limiter that hard-fails on a database hiccup turns a transient outage
    // into a total auth outage.
    expect(await consumeRateLimit("k", RULE)).toEqual({
      allowed: true,
      remaining: RULE.limit,
      retryAfterMs: 0,
    });
  });

  it("counts and rolls the window in a single statement", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ] as never);

    await consumeRateLimit("k", RULE);

    // A read-then-write would let two concurrent attempts both observe the old
    // count and slip past the limit, so this must be one round-trip.
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });
});

describe("isRateLimited", () => {
  it("is false when no counter exists", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue(null);
    expect(await isRateLimited("k", RULE)).toBe(false);
  });

  it("is true at or past the limit inside the window", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      key: "k",
      count: 5,
      expiresAt: new Date(Date.now() + 30_000),
    } as never);

    expect(await isRateLimited("k", RULE)).toBe(true);
  });

  it("is false once the window has expired, however high the count", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      key: "k",
      count: 500,
      expiresAt: new Date(Date.now() - 1),
    } as never);

    // Otherwise a lockout would never lift.
    expect(await isRateLimited("k", RULE)).toBe(false);
  });

  it("does not consume budget", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue(null);

    await isRateLimited("k", RULE);

    // A locked-out account must not extend its own lockout just by being
    // checked.
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("resetRateLimit", () => {
  it("swallows a database failure", async () => {
    vi.mocked(prisma.rateLimit.deleteMany).mockRejectedValue(
      new Error("connection lost"),
    );

    // Best effort: a stale counter expires on its own, and throwing here would
    // fail an otherwise successful sign-in.
    await expect(resetRateLimit("k")).resolves.toBeUndefined();
  });
});

describe("getClientIp", () => {
  it("prefers x-real-ip", async () => {
    headerStore.get.mockImplementation((name: string) =>
      name === "x-real-ip" ? "198.51.100.7" : null,
    );

    expect(await getClientIp()).toBe("198.51.100.7");
  });

  it("takes the last x-forwarded-for entry, not the first", async () => {
    headerStore.get.mockImplementation((name: string) =>
      name === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8, 203.0.113.9" : null,
    );

    // The proxy appends the real peer address. Taking the first entry would
    // let an attacker spoof the header and rotate past every limit.
    expect(await getClientIp()).toBe("203.0.113.9");
  });

  it("falls back to a shared bucket when no header is present", async () => {
    headerStore.get.mockReturnValue(null);

    // Degrades to a global limit rather than to no limit at all.
    expect(await getClientIp()).toBe("unknown");
  });
});

describe("configured limits", () => {
  it("keeps the per-account login lockout tighter than the per-IP budget", () => {
    expect(RATE_LIMITS.loginPerEmail.limit).toBeLessThan(
      RATE_LIMITS.loginPerIp.limit,
    );
  });

  it("bounds reset emails per address so we cannot be used to flood an inbox", () => {
    expect(RATE_LIMITS.resetRequestPerEmail.limit).toBeLessThanOrEqual(5);
  });
});
