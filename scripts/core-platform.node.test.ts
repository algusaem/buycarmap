import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

// Checks the working tree against docs/specs/core-platform.md, PLAT-1..9,
// PLAT-12, PLAT-16, PLAT-18, PLAT-24, PLAT-25 and PLAT-26. The behavioural
// halves of PLAT-8, -9, -12, -16, -18, -21..24 that need module imports or
// runtime execution are covered by their own colocated test files.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const _exists = (path: string) => existsSync(join(ROOT, path));

function gitLsFiles(...pathspecs: string[]): string[] {
  const output = execFileSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return output === "" ? [] : output.split("\n");
}

describe("env module", () => {
  it("PLAT-1: lib/env.ts is built with @t3-oss/env-nextjs createEnv", () => {
    const source = read("lib/env.ts");

    expect(source).toContain('from "@t3-oss/env-nextjs"');
    expect(source).toMatch(/\bcreateEnv\s*\(/);
  });

  it("PLAT-1: the client block declares only NEXT_PUBLIC_SENTRY_DSN and NEXT_PUBLIC_CARTO_API_KEY", () => {
    const source = read("lib/env.ts");

    const clientBlock = source.match(/client:\s*\{([\s\S]*?)\}/);
    expect(clientBlock).not.toBeNull();
    // One key per line that opens with an identifier and a colon, so comment
    // lines inside the block are not mistaken for keys.
    const keys = [...(clientBlock?.[1] ?? "").matchAll(/^\s*([A-Z0-9_]+)\s*:/gm)].map(
      (match) => match[1],
    );
    expect(keys).toEqual(["NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_CARTO_API_KEY"]);
  });

  it("PLAT-1: DATABASE_URL and BETTER_AUTH_SECRET stay required (not .optional())", () => {
    const source = read("lib/env.ts");

    const databaseUrlLine = source.match(/DATABASE_URL:\s*[^\n]+/)?.[0] ?? "";
    const betterAuthSecretLine = source.match(/BETTER_AUTH_SECRET:\s*[^\n]+/)?.[0] ?? "";
    expect(databaseUrlLine).not.toContain(".optional()");
    expect(betterAuthSecretLine).not.toContain(".optional()");
  });

  it("PLAT-2: lib/env.ts no longer imports dotenv", () => {
    expect(read("lib/env.ts")).not.toMatch(/import\s+(?:.*\s+from\s+)?["']dotenv/);
  });

  it("PLAT-2: lib/env.ts never calls console", () => {
    expect(read("lib/env.ts")).not.toMatch(/\bconsole\./);
  });

  it("PLAT-5: lib/env.ts is Edge-safe — no dotenv and no node: import", () => {
    const source = read("lib/env.ts");

    expect(source).not.toMatch(/import\s+(?:.*\s+from\s+)?["']dotenv/);
    expect(source).not.toMatch(/import\s+(?:.*\s+from\s+)?["']node:/);
  });
});

describe("next.config.ts wires env validation", () => {
  it("PLAT-3: next.config.ts imports lib/env.ts", () => {
    expect(read("next.config.ts")).toMatch(/from ["'](@\/)?\.?\/?lib\/env["']/);
  });

  it("PLAT-3: pnpm lint sets SKIP_ENV_VALIDATION=1 through cross-env", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.lint ?? "").toContain("cross-env SKIP_ENV_VALIDATION=1");
  });
});

describe("proxy.ts reads its configuration through lib/env.ts", () => {
  it("PLAT-5: proxy.ts imports the env module and reads no process.env directly", () => {
    const source = read("proxy.ts");

    expect(source).toMatch(/from ["'](@\/)?\.?\/?lib\/env["']/);
    expect(source).not.toMatch(/process\.env/);
  });
});

describe("PLAT-4: process.env is read only from lib/env.ts", () => {
  it("PLAT-4: no other file under app/, components/, lib/, server/, proxy.ts, next.config.ts or instrumentation*.ts reads process.env", () => {
    const files = gitLsFiles(
      "app",
      "components",
      "lib",
      "server",
      "proxy.ts",
      "next.config.ts",
      "instrumentation.ts",
      "instrumentation-client.ts",
    ).filter((file) => !/\.test\.tsx?$/.test(file) && file !== "lib/env.ts");

    // instrumentation.ts reads the literal `process.env.NEXT_RUNTIME` twice —
    // Next.js only recognises that exact literal to strip the "nodejs" branch
    // (and lib/sentry.ts with it) from the Edge bundle; routing it through
    // lib/env.ts defeated that analysis (PLAT-4, docs/specs/core-platform.md).
    // Exempt exactly that literal, nothing else.
    const offenders = files.filter((file) => {
      const source =
        file === "instrumentation.ts"
          ? read(file).replaceAll("process.env.NEXT_RUNTIME", "")
          : read(file);
      return /process\.env/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});

describe("PLAT-6: only lib/db/prisma.ts instantiates a Prisma client or adapter", () => {
  it("no other tracked file constructs PrismaClient, PrismaPg or PrismaNeon", () => {
    const files = gitLsFiles("app", "components", "lib", "server", "proxy.ts").filter(
      (file) =>
        !/\.test\.tsx?$/.test(file) &&
        !file.startsWith("app/generated/") &&
        file !== "lib/db/prisma.ts",
    );

    const pattern = /\bnew\s+(PrismaClient|PrismaPg|PrismaNeon)\s*\(/;
    const offenders = files.filter((file) => pattern.test(read(file)));

    expect(offenders).toEqual([]);
  });
});

describe("PLAT-7: the dev-reload cache is typed, not cast", () => {
  it("lib/db/prisma.ts declares the globalThis augmentation and avoids `as unknown as`", () => {
    const source = read("lib/db/prisma.ts");

    expect(source).toMatch(/declare global\s*\{/);
    expect(source).not.toContain("as unknown as");
  });
});

describe("PLAT-9: the build runs migrations before next build", () => {
  it("package.json's build script is exactly the three-step chain", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.build).toBe(
      "prisma generate && node scripts/migrate-deploy.mjs && next build",
    );
  });
});

describe("PLAT-12: unexpected is no longer a declared error code", () => {
  it("ALERT_ERROR has no unexpected key", async () => {
    const { ALERT_ERROR } = await import("@/server/alerts/schema");

    expect(Object.keys(ALERT_ERROR)).not.toContain("unexpected");
  });

  it("FAVORITE_ERROR has no unexpected key", async () => {
    const { FAVORITE_ERROR } = await import("@/server/favorites/schema");

    expect(Object.keys(FAVORITE_ERROR)).not.toContain("unexpected");
  });
});

describe("PLAT-16: console is replaced by the logger", () => {
  it("PLAT-16: no console.* call remains in app/, components/, lib/ or server/ (excluding tests)", () => {
    const files = gitLsFiles("app", "components", "lib", "server").filter(
      (file) => !/\.test\.tsx?$/.test(file) && !file.startsWith("app/generated/"),
    );

    const offenders = files.filter((file) => /\bconsole\.\w+\s*\(/.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("PLAT-16: biome.json enables noConsole as a plain error, with no allow-list, for app/components/lib/server", () => {
    const biomeJson = JSON.parse(read("biome.json")) as {
      linter?: {
        rules?: {
          suspicious?: {
            noConsole?: string | { level?: unknown; options?: { allow?: unknown } };
          };
        };
      };
    };
    const noConsole = biomeJson.linter?.rules?.suspicious?.noConsole;
    const level = typeof noConsole === "string" ? noConsole : noConsole?.level;
    const allow = typeof noConsole === "string" ? undefined : noConsole?.options?.allow;

    expect(level).toBe("error");
    expect(allow).toBeUndefined();
  });
});

describe("PLAT-18: browser Sentry events go through the tunnel route", () => {
  it('next.config.ts configures tunnelRoute: "/monitoring"', () => {
    expect(read("next.config.ts")).toContain('tunnelRoute: "/monitoring"');
  });
});

describe("PLAT-24: next.config.ts no longer sends Content-Security-Policy", () => {
  it("PLAT-24: Content-Security-Policy is gone, Strict-Transport-Security stays", () => {
    const source = read("next.config.ts");

    expect(source).not.toContain("Content-Security-Policy");
    expect(source).toContain("Strict-Transport-Security");
  });
});

describe("PLAT-25: ADR 0013 records the CSP-nonce/dynamic-rendering trade-off", () => {
  it("PLAT-25: docs/decisions/0013-*.md exists and mentions nonce and dynamic rendering", () => {
    const decisionsDir = join(ROOT, "docs/decisions");
    const files = existsSync(decisionsDir) ? readdirSync(decisionsDir) : [];
    const adrFiles = files.filter((name) => /^0013-.*\.md$/.test(name));

    expect(adrFiles.length).toBe(1);

    const adrText = read(`docs/decisions/${adrFiles[0]}`);
    expect(adrText).toMatch(/nonce/i);
    expect(adrText).toMatch(/dynamic/i);
  });
});

describe("PLAT-26: docs and .env.example record the new configuration", () => {
  it("PLAT-26: .env.example lists every new variable", () => {
    const envExample = read(".env.example");
    const required = [
      "DIRECT_URL",
      "SENTRY_DSN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "SENTRY_AUTH_TOKEN",
      "SENTRY_ORG",
      "SENTRY_PROJECT",
      "SKIP_ENV_VALIDATION",
    ];

    const missing = required.filter((name) => !envExample.includes(name));
    expect(missing).toEqual([]);
  });

  it("docs/privacy/processors.md lists Sentry and that sendDefaultPii is off", () => {
    const processors = read("docs/privacy/processors.md");

    expect(processors).toContain("Sentry");
    expect(processors).toContain("sendDefaultPii");
  });

  it("docs/ARCHITECTURE.md describes the env module, adapters, migration step, logger, Sentry, health and CSP", () => {
    const architecture = read("docs/ARCHITECTURE.md");
    const required = [
      "@t3-oss/env-nextjs",
      "PrismaNeon",
      "migrate deploy",
      "Pino",
      "Sentry",
      "/api/health/db",
      "nonce",
    ];

    const missing = required.filter((term) => !architecture.includes(term));
    expect(missing).toEqual([]);
  });

  it("ADR 0007 marks rows 11-15 resolved", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const lines = adr.split("\n");

    for (const rowNumber of [11, 12, 13, 14, 15]) {
      const row = lines.find((line) => line.trim().startsWith(`| ${rowNumber} |`));
      expect(row, `row ${rowNumber} not found`).toBeDefined();
      expect(row?.trim().endsWith("Resolved in phase 6 |")).toBe(true);
    }
  });
});

describe("PLAT-8: prisma.config.ts prefers DIRECT_URL over DATABASE_URL", () => {
  async function loadDatasourceUrl(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        vi.stubEnv(key, "");
      } else {
        vi.stubEnv(key, value);
      }
    }
    const mod = await import("../prisma.config");
    return (mod.default as { datasource?: { url?: string } }).datasource?.url;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("PLAT-8: uses DIRECT_URL when it is set", async () => {
    const url = await loadDatasourceUrl({
      DIRECT_URL: "postgres://a",
      DATABASE_URL: "postgres://b",
    });

    expect(url).toBe("postgres://a");
  });

  it("PLAT-8: falls back to DATABASE_URL when DIRECT_URL is unset", async () => {
    const url = await loadDatasourceUrl({ DATABASE_URL: "postgres://b" });

    expect(url).toBe("postgres://b");
  });
});
