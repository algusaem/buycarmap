import { beforeEach, describe, expect, it, vi } from "vitest";

// TEST-7 (docs/specs/core-testing.md): consumeRateLimit, isRateLimited and
// resetRateLimit moved to ./service.integration.test.ts, which runs against
// a real database. These two blocks never touch Prisma at all — getClientIp
// only reads request headers, and the configured-limits checks are plain
// constant comparisons — so they stay here with no @/lib/db/prisma mock.

const headerStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ headers: vi.fn(async () => headerStore) }));

import { RATE_LIMITS, getClientIp } from "./service";

beforeEach(() => {
  headerStore.get.mockReset();
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
    expect(RATE_LIMITS.loginPerEmail.limit).toBeLessThan(RATE_LIMITS.loginPerIp.limit);
  });

  it("bounds reset emails per address so we cannot be used to flood an inbox", () => {
    expect(RATE_LIMITS.resetRequestPerEmail.limit).toBeLessThanOrEqual(5);
  });
});
