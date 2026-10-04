import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Checks the working tree against docs/specs/core-integrations.md — the
// structural (non-behavioural) halves of INT-1, INT-5, INT-6, INT-9, INT-12,
// INT-15 and INT-16. The behavioural halves live in their own colocated test
// files: lib/platform/rate-limit.node.test.ts, lib/platform/email.node.test.ts,
// scripts/qstash-schedule.node.test.ts, emails/emails.node.test.ts,
// app/api/alerts/run/route.integration.test.ts and
// server/rate-limit/service.integration.test.ts.

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

// Application source only — never docs/specs or docs/decisions, which are
// expected to name these dependencies in prose (STACK.md §1 already does).
const SOURCE_DIRS = ["app", "components", "lib", "server", "scripts", "proxy.ts"];
const isTestFile = (file: string) => /\.(test|node\.test|integration\.test)\.tsx?$/.test(file);

describe("INT-1: only the rate-limit adapter imports Upstash's rate-limit SDK", () => {
  it("INT-1: no other tracked source file references @upstash/ratelimit or @upstash/redis", () => {
    const files = gitLsFiles(...SOURCE_DIRS).filter(
      (file) => !isTestFile(file) && file !== "lib/platform/rate-limit.ts",
    );
    const offenders = files.filter((file) => /@upstash\/(ratelimit|redis)/.test(read(file)));

    expect(offenders).toEqual([]);
  });
});

describe("INT-6: no code reads or writes the RateLimit table any more", () => {
  it("INT-6: no non-test file under app/, lib/ or server/ uses prisma.rateLimit", () => {
    const files = gitLsFiles("app", "lib", "server").filter((file) => !isTestFile(file));
    const offenders = files.filter((file) => /\bprisma\.rateLimit\b/.test(read(file)));

    expect(offenders).toEqual([]);
  });
});

describe("INT-9: the GitHub Actions cron and its secret are gone", () => {
  it("INT-9: .github/workflows/alerts.yml no longer exists", () => {
    expect(exists(".github/workflows/alerts.yml")).toBe(false);
  });

  it("INT-9: no tracked file except the spec and the ADRs references ALERTS_CRON_SECRET", () => {
    const files = gitLsFiles(".").filter(
      (file) =>
        file !== "docs/specs/core-integrations.md" &&
        file !== "scripts/core-integrations.node.test.ts" &&
        !file.startsWith("docs/decisions/"),
    );
    const offenders = files.filter((file) => read(file).includes("ALERTS_CRON_SECRET"));

    expect(offenders).toEqual([]);
  });
});

describe("INT-12: only the email adapter imports resend", () => {
  it("INT-12: no other tracked source file imports resend", () => {
    const files = gitLsFiles(...SOURCE_DIRS).filter(
      (file) => !isTestFile(file) && file !== "lib/platform/email.ts",
    );
    const offenders = files.filter((file) => /from\s+["']resend["']/.test(read(file)));

    expect(offenders).toEqual([]);
  });
});

describe("INT-15: the string-template email client is gone", () => {
  it("INT-15: lib/email/templates/ no longer exists", () => {
    expect(exists("lib/email/templates")).toBe(false);
  });

  it("INT-15: DESIGN.md describes the react-email components instead of the string layout", () => {
    expect(read("DESIGN.md")).toMatch(/react-email/i);
  });
});

describe("INT-16: the docs record the migration", () => {
  it("INT-16: ADR 0017 exists", () => {
    const decisionsDir = join(ROOT, "docs/decisions");
    const files = existsSync(decisionsDir) ? readdirSync(decisionsDir) : [];

    expect(files.filter((name) => /^0017-.*\.md$/.test(name)).length).toBe(1);
  });

  it("INT-16: ADRs 0005 and 0006 are marked superseded", () => {
    expect(read("docs/decisions/0005-postgres-rate-limiting.md")).toMatch(/superseded/i);
    expect(read("docs/decisions/0006-alert-scheduling.md")).toMatch(/superseded/i);
  });

  it("INT-16: docs/privacy/processors.md adds Upstash", () => {
    expect(read("docs/privacy/processors.md")).toMatch(/Upstash/);
  });

  it("INT-16: .env.example lists every new variable", () => {
    const envExample = read(".env.example");
    const required = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "QSTASH_TOKEN",
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
    ];

    const missing = required.filter((name) => !envExample.includes(name));
    expect(missing).toEqual([]);
  });

  it("INT-16: ADR 0007 rows 22-24 end 'Resolved in phase 10'", () => {
    const adr = read("docs/decisions/0007-adopt-core-rules.md");
    const lines = adr.split("\n");

    for (const rowNumber of [22, 23, 24]) {
      const row = lines.find((line) => line.trim().startsWith(`| ${rowNumber} |`));
      expect(row, `row ${rowNumber} not found`).toBeDefined();
      expect(row?.trim().endsWith("Resolved in phase 10 |")).toBe(true);
    }
  });
});

describe("INT-5: a local Upstash-compatible Redis is available", () => {
  it("INT-5: docker-compose.yml declares a redis service and a serverless-redis-http service on 8079", () => {
    const compose = read("docker-compose.yml");

    // Amended (docs/specs/core-integrations.md, INT-5): @upstash/ratelimit's
    // Lua scripts carry an Upstash-only Redis flag that a real local Redis
    // rejects outright (docs/decisions/0017-upstash-qstash-react-email.md),
    // so there is no local Redis any more — rate limiting disables itself
    // instead (lib/platform/rate-limit.ts), and its own tests exercise the
    // real sliding-window math against an in-memory fake
    // (test/fakes/ratelimit.ts).
    expect(compose).not.toMatch(/^\s*redis:/m);
    expect(compose).not.toMatch(/serverless-redis-http/);
  });
});
