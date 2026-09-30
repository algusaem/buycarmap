import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Checks the working tree against docs/specs/core-testing.md, TEST-1, TEST-4,
// TEST-5, TEST-7, TEST-9, TEST-12, TEST-13 and TEST-14 — the tree- and
// config-shaped criteria that need no database. The behavioural halves
// (TEST-2, TEST-3, TEST-6, TEST-8, TEST-10, TEST-11) are covered by their own
// colocated test files.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const exists = (path: string) => existsSync(join(ROOT, path));

function gitLsFiles(...pathspecs: string[]): string[] {
  const output = execFileSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return output === "" ? [] : output.split("\n");
}

interface PackageJson {
  scripts?: Record<string, string>;
}

function packageJson(): PackageJson {
  return JSON.parse(read("package.json")) as PackageJson;
}

// --- TEST-1: the Compose database ------------------------------------------

describe("TEST-1: docker-compose.yml defines the local Postgres", () => {
  it("TEST-1: uses postgres:17-alpine, publishes 5433:5432 and declares a named volume", () => {
    const compose = read("docker-compose.yml");

    expect(compose).toMatch(/image:\s*postgres:17-alpine/);
    expect(compose).toMatch(/["']?5433:5432["']?/);
    // A named volume, not a bind mount or an anonymous one: `volumes:` at the
    // top level naming at least one entry that a service also mounts.
    expect(compose).toMatch(/^volumes:\s*$/m);
  });

  it("TEST-1: pnpm db:up starts it and pnpm db:down stops it without deleting the volume", () => {
    const scripts = packageJson().scripts ?? {};

    expect(scripts["db:up"]).toBe("docker compose up -d");
    expect(scripts["db:down"]).toMatch(/^docker compose (stop|down)$/);
    // `down -v` or `down --volumes` would delete the named volume along with
    // every branch database it holds.
    expect(scripts["db:down"]).not.toMatch(/-v\b|--volumes\b/);
  });
});

// --- TEST-4: .env.example and the README ------------------------------------

describe("TEST-4: .env.example points at the Compose database", () => {
  it("TEST-4: DATABASE_URL's line mentions localhost:5433", () => {
    const envExample = read(".env.example");
    const line = envExample.split("\n").find((l) => /^DATABASE_URL=/.test(l.trim()));

    expect(line, "expected a DATABASE_URL line in .env.example").toBeDefined();
    expect(line).toContain("localhost:5433");
  });

  it("TEST-4: no longer declares the Neon-only tooling variables", () => {
    const envExample = read(".env.example");

    expect(envExample).not.toContain("NEON_API_KEY");
    expect(envExample).not.toContain("NEON_PROJECT_ID");
  });

  it("TEST-4: lib/env.ts never declares NEON_API_KEY or NEON_PROJECT_ID either", () => {
    const envModule = read("lib/env.ts");

    expect(envModule).not.toContain("NEON_API_KEY");
    expect(envModule).not.toContain("NEON_PROJECT_ID");
  });

  it("TEST-4: the README's setup and worktree sections describe Docker Desktop, pnpm db:up and pnpm db:branch", () => {
    const readme = read("README.md");

    expect(readme).toContain("Docker Desktop");
    expect(readme).toContain("pnpm db:up");
    expect(readme).toContain("pnpm db:branch");
  });
});

// --- TEST-5: the three Vitest projects --------------------------------------

describe("TEST-5: Vitest has unit, node and integration projects", () => {
  it("TEST-5: vitest.config.ts declares exactly unit, node and integration, with integration matching *.integration.test.ts", async () => {
    // Imported rather than read as text: the project list is the one thing
    // here worth checking against what Vitest itself would resolve, not a
    // string match against source formatting.
    const config = (await import("../vitest.config")).default as {
      test?: { projects?: { test?: { name?: string; include?: string[] } }[] };
    };
    const projects = config.test?.projects ?? [];
    const names = projects.map((p) => p.test?.name).sort();

    expect(names).toEqual(["integration", "node", "unit"]);

    const integration = projects.find((p) => p.test?.name === "integration");
    expect(integration?.test?.include?.some((glob) => glob.includes("*.integration.test.ts"))).toBe(
      true,
    );
  });

  it("TEST-5: package.json: test:unit runs unit and node, test:integration runs integration, test runs all three with coverage", () => {
    const scripts = packageJson().scripts ?? {};

    expect(scripts["test:unit"]).toContain("--project unit");
    expect(scripts["test:unit"]).toContain("--project node");
    expect(scripts["test:unit"]).not.toContain("--project integration");
    expect(scripts["test:integration"]).toBe("vitest run --project integration");
    expect(scripts.test).toContain("--coverage");
    expect(scripts.test).not.toContain("--project");
  });

  it("TEST-5: .husky/pre-commit passes --project unit --project node and never integration", () => {
    const preCommit = read(".husky/pre-commit");

    expect(preCommit).toContain("--project unit");
    expect(preCommit).toContain("--project node");
    expect(preCommit).not.toContain("--project integration");
  });
});

// --- TEST-7: the Prisma-mock allow-list --------------------------------------

// Exactly the files TEST-7 allows to still mock @/lib/db/prisma once the
// conversion lands, and why each one does:
//   - the /api/health and /api/health/db route tests, whose whole point is
//     PLAT-19 ("never touches the database") and the health-db 503 path,
//     which can only be produced by making the database call fail;
//   - server/favorites/actions.node.test.ts, server/alerts/actions.node.test.ts
//     and server/locale/actions.node.test.ts, each of which keeps its
//     PLAT-12 "a database failure rejects instead of returning an error
//     Result" case(s), which need a call that can be made to fail on demand.
const ALLOW_LISTED_PRISMA_MOCKS = [
  "app/api/health/route.node.test.ts",
  "app/api/health/db/route.node.test.ts",
  "server/favorites/actions.node.test.ts",
  "server/alerts/actions.node.test.ts",
  "server/locale/actions.node.test.ts",
];

// The 21 files docs/specs/core-testing.md names as mocking @/lib/db/prisma
// before this migration. TEST-7 requires that, outside the allow-list above,
// none of them still do.
const ORIGINAL_PRISMA_MOCKING_FILES = [
  "app/api/alerts/run/route.node.test.ts",
  "app/api/alerts/unsubscribe/route.node.test.ts",
  "app/api/health/db/route.node.test.ts",
  "app/api/health/route.node.test.ts",
  "lib/auth/options.node.test.ts",
  "server/account/actions.node.test.ts",
  "server/alerts/actions.node.test.ts",
  "server/alerts/service.node.test.ts",
  "server/auth/authorize.test.ts",
  "server/auth/cleanup.node.test.ts",
  "server/email-verification/actions.node.test.ts",
  "server/favorites/actions.node.test.ts",
  "server/locale/actions.node.test.ts",
  "server/password-reset/forgot-password.node.test.ts",
  "server/password-reset/reset-password.node.test.ts",
  "server/rate-limit/service.node.test.ts",
  "server/registration/register.node.test.ts",
  "server/registration/resend-confirmation.node.test.ts",
  "server/registration/verify-registration.node.test.ts",
  "server/two-factor/actions.node.test.ts",
  "server/two-factor/verify.node.test.ts",
];

describe("TEST-7: only the allow-listed files still mock @/lib/db/prisma", () => {
  // Built from parts so this file does not contain the literal it searches for.
  const PRISMA_MOCK = ["vi.mock(", '"@/lib/db/prisma"'].join("");

  it("TEST-7: git ls-files test files that mock @/lib/db/prisma are exactly the allow-list", () => {
    // `git ls-files` lists the index, not the working tree, so a path removed
    // here but not yet `git rm`-ed still appears; `exists` filters those out
    // rather than letting a missing file throw.
    const candidates = gitLsFiles(
      "*.test.ts",
      "*.test.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
    ).filter(exists);
    const mocking = candidates.filter((file) => read(file).includes(PRISMA_MOCK));

    expect(mocking.sort()).toEqual([...ALLOW_LISTED_PRISMA_MOCKS].sort());
  });

  it("TEST-7: none of the 21 original paths still mock Prisma unless allow-listed", () => {
    const stillMocking = ORIGINAL_PRISMA_MOCKING_FILES.filter(
      (file) => exists(file) && read(file).includes(PRISMA_MOCK),
    );

    expect(stillMocking.sort()).toEqual([...ALLOW_LISTED_PRISMA_MOCKS].sort());
  });
});

// --- TEST-9: CI ---------------------------------------------------------------

describe("TEST-9: CI runs the integration tests through pnpm check, never db:seed", () => {
  it("TEST-9: .github/workflows/test.yml's check job runs pnpm check", () => {
    const workflow = read(".github/workflows/test.yml");

    expect(workflow).toMatch(/run:\s*pnpm check\s*$/m);
  });

  it("TEST-9: no workflow file runs db:seed", () => {
    const workflowDir = join(ROOT, ".github/workflows");
    const files = existsSync(workflowDir) ? readdirSync(workflowDir) : [];
    const offenders = files.filter((file) => read(`.github/workflows/${file}`).includes("db:seed"));

    expect(offenders).toEqual([]);
  });
});

// --- TEST-12: the seed never runs in the build --------------------------------
// (TEST-12 itself is named by prisma/seed.node.test.ts; this is a
// tree-shaped companion check that belongs with the other package.json
// assertions above.)

describe("package.json's build script never runs the seed", () => {
  it("TEST-12: build does not contain db:seed or prisma db seed", () => {
    const build = packageJson().scripts?.build ?? "";

    expect(build).not.toContain("seed");
  });
});

// --- TEST-13: coverage ---------------------------------------------------------

describe("TEST-13: coverage include adds scripts/** and prisma/seed.ts; the thresholds stay", async () => {
  const config = (await import("../vitest.config")).default as {
    test?: {
      coverage?: {
        include?: string[];
        exclude?: string[];
        thresholds?: {
          statements?: number;
          branches?: number;
          functions?: number;
          lines?: number;
        };
      };
    };
  };
  const coverage = config.test?.coverage;

  it("TEST-13: include contains scripts/** and prisma/seed.ts", () => {
    expect(coverage?.include).toContain("scripts/**");
    expect(coverage?.include).toContain("prisma/seed.ts");
  });

  it("TEST-13: exclude no longer excludes **/index.ts", () => {
    expect(coverage?.exclude ?? []).not.toContain("**/index.ts");
  });

  it("TEST-13: thresholds stay at 89/85/84/89", () => {
    expect(coverage?.thresholds).toEqual({
      statements: 89,
      branches: 85,
      functions: 84,
      lines: 89,
    });
  });
});

// --- TEST-14: docs ---------------------------------------------------------------

describe("TEST-14: docs record the decisions and the new testing setup", () => {
  it("TEST-14: docs/decisions/0014-*.md exists and mentions truncation and the three projects", () => {
    const decisionsDir = join(ROOT, "docs/decisions");
    const files = existsSync(decisionsDir) ? readdirSync(decisionsDir) : [];
    const adrFiles = files.filter((name) => /^0014-.*\.md$/.test(name));

    expect(adrFiles.length).toBe(1);

    const adrText = read(`docs/decisions/${adrFiles[0]}`);
    expect(adrText).toMatch(/truncat/i);
    expect(adrText).toMatch(/\b(three|node)\b/i);
  });

  it("TEST-14: ADR 0007 marks rows 16, 17 and 27 Resolved in phase 7", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const lines = adr.split("\n");

    for (const rowNumber of [16, 17, 27]) {
      const row = lines.find((line) => line.trim().startsWith(`| ${rowNumber} |`));
      expect(row, `row ${rowNumber} not found`).toBeDefined();
      expect(row?.trim().endsWith("Resolved in phase 7 |")).toBe(true);
    }
  });

  it("TEST-14: docs/ARCHITECTURE.md mentions Testcontainers, Docker Compose, db:seed and test/factories", () => {
    const architecture = read("docs/ARCHITECTURE.md");
    const required = ["Testcontainers", "db:seed", "test/factories"];

    const missing = required.filter((term) => !architecture.includes(term));
    expect(missing).toEqual([]);
    expect(architecture).toMatch(/docker compose|Docker Compose/i);
  });

  it("TEST-14: CLAUDE.md mentions pnpm db:up", () => {
    expect(read("CLAUDE.md")).toContain("pnpm db:up");
  });
});
