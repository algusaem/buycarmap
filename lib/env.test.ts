import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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

// docs/specs/map-maplibre.md (MAPLIBRE-12): lib/env.ts drops
// NEXT_PUBLIC_CARTO_API_KEY, so its `client` block amends PLAT-1 down to one
// key, and no source file under app/, components/, lib/ or server/ reads the
// CARTO key any more. Reads the same way the existing PLAT-1 test
// (scripts/core-platform.node.test.ts) reads the client block, by regex over
// the source text rather than by importing `env` (a client var only resolves
// through `createEnv` in the browser).
const ROOT = process.cwd();

function listFilesRecursively(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    // app/generated/prisma is gitignored, generated code outside this check's
    // concern (and may not exist at all before `prisma generate` has run).
    if (entry.isDirectory() && entry.name === "generated") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function collectSourceFiles(): string[] {
  const files: string[] = [];
  for (const dir of ["app", "components", "lib", "server"]) {
    const full = join(ROOT, dir);
    try {
      if (statSync(full).isDirectory()) files.push(...listFilesRecursively(full));
    } catch {
      // The directory does not exist in this checkout; nothing to scan.
    }
  }
  return files;
}

describe("MAPLIBRE-12 (docs/specs/map-maplibre.md): the CARTO key is gone from the client env and the source tree", () => {
  it('MAPLIBRE-12: lib/env.ts\'s client block declares only ["NEXT_PUBLIC_SENTRY_DSN"]', () => {
    const source = readFileSync(join(ROOT, "lib/env.ts"), "utf8");

    const clientBlock = source.match(/client:\s*\{([\s\S]*?)\}/);
    expect(clientBlock).not.toBeNull();
    const keys = [...(clientBlock?.[1] ?? "").matchAll(/^\s*([A-Z0-9_]+)\s*:/gm)].map(
      (match) => match[1],
    );
    expect(keys).toEqual(["NEXT_PUBLIC_SENTRY_DSN"]);
  });

  it("MAPLIBRE-12: no file under app/, components/, lib/ or server/ reads NEXT_PUBLIC_CARTO_API_KEY", () => {
    const offenders = collectSourceFiles()
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes("NEXT_PUBLIC_CARTO_API_KEY"));

    expect(offenders).toEqual([]);
  });
});
