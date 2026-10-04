import { afterEach, describe, expect, it, vi } from "vitest";

// PLAT-1 and PLAT-3 (docs/specs/core-platform.md): lib/env.ts moves onto
// @t3-oss/env-nextjs' createEnv, which validates at import time and honours
// SKIP_ENV_VALIDATION=1. Each case resets the module registry so it can
// re-import with the environment it needs.
async function loadEnvModule() {
  vi.resetModules();
  return import("./env");
}

describe("lib/env.ts validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("PLAT-1: rejects an empty DATABASE_URL with a message naming it", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
    vi.stubEnv("SKIP_ENV_VALIDATION", undefined);

    await expect(loadEnvModule()).rejects.toThrow(/DATABASE_URL/);
  });

  it("PLAT-1: resolves with the required vars set and reports optional ones as undefined", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/buycarmap_test");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
    vi.stubEnv("SKIP_ENV_VALIDATION", undefined);
    vi.stubEnv("RESEND_API_KEY", undefined);
    vi.stubEnv("EMAIL_FROM", undefined);
    vi.stubEnv("APP_URL", undefined);

    const { env } = await loadEnvModule();

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it("PLAT-3: SKIP_ENV_VALIDATION=1 with DATABASE_URL unset does not throw", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it("INT-5: production and preview builds require the Upstash variables", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/buycarmap_test");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
    vi.stubEnv("SKIP_ENV_VALIDATION", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);

    vi.stubEnv("VERCEL_ENV", "production");
    await expect(loadEnvModule()).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);

    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(loadEnvModule()).rejects.toThrow(/UPSTASH_REDIS_REST_TOKEN/);

    vi.stubEnv("VERCEL_ENV", undefined);
    await expect(loadEnvModule()).resolves.toBeDefined();
  });
});
