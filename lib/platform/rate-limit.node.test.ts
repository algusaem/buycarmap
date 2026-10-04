import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { logger } from "@/lib/logger";
import { consume, redisKey } from "./rate-limit";
import type { LimiterFactory, RateLimitRule } from "./rate-limit";

// docs/specs/core-integrations.md, INT-2/INT-3/INT-4. The adapter itself is a
// stub (not implemented), so every case below fails as an assertion rather
// than on import.

describe("redisKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("INT-2: prefixes a key with the Vercel preview environment", () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(redisKey("register:ip:203.0.113.7")).toBe("preview:register:ip:203.0.113.7");
  });

  it("INT-2: falls back to development when VERCEL_ENV is unset", () => {
    vi.stubEnv("VERCEL_ENV", "");

    expect(redisKey("register:ip:203.0.113.7")).toBe("development:register:ip:203.0.113.7");
  });

  it("INT-3: hashes a login:email key instead of sending the address in clear", () => {
    // Hand-derived with node:crypto from the literal lowercased address —
    // the same way the real adapter is expected to key it.
    const expectedHash = createHash("sha256").update("ana@example.com").digest("hex");

    expect(redisKey("login:email:Ana@Example.com")).toBe(`development:login:email:${expectedHash}`);
  });

  it("INT-3: leaves an IP segment as it is, because a per-IP limit needs the IP", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(redisKey("register:ip:203.0.113.7")).toBe("production:register:ip:203.0.113.7");
  });
});

describe("consume", () => {
  const LOGIN_PER_IP: RateLimitRule = { name: "loginPerIp", limit: 20, windowMs: 15 * 60_000 };

  it("INT-4: fails open and logs a warn naming the rule, never the key, when Redis rejects", async () => {
    const brokenLimiterFactory: LimiterFactory = () => ({
      limit: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
      getRemaining: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
      resetUsedTokens: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    });
    vi.mocked(logger.warn).mockClear();

    const result = await consume("login:ip:203.0.113.7", LOGIN_PER_IP, brokenLimiterFactory);

    expect(result.allowed).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [meta] = vi.mocked(logger.warn).mock.calls[0] ?? [{}];
    expect(meta).toEqual({ rule: "loginPerIp" });
  });
});
