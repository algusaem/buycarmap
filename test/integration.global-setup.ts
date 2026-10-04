import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

// TEST-6 (docs/specs/core-testing.md): one postgres:17-alpine container per
// run, migrated once to a template database. Each Vitest worker then copies
// its own database from that template (test/setup.integration.ts), so
// integration test files run in parallel without sharing rows.
//
// INT-5 (docs/specs/core-integrations.md): no local Upstash-compatible Redis
// is started for this project. `@upstash/ratelimit`'s Lua scripts carry a
// Redis flag that is an Upstash-only extension
// (docs/decisions/0017-upstash-qstash-react-email.md); a real local Redis
// rejects it outright, so a local container never exercised the real
// sliding-window algorithm anyway. Without the `UPSTASH_*` variables,
// `lib/platform/rate-limit.ts` disables rate limiting (one warning, allow
// every request); `server/rate-limit/service.integration.test.ts` exercises
// the real sliding-window math against an in-memory fake instead
// (`test/fakes/ratelimit.ts`).
//
// The container's connection details are handed to every worker through
// Vitest's `provide`/`inject`, declared below so `inject(...)` is typed.

declare module "vitest" {
  export interface ProvidedContext {
    pgHost: string;
    pgPort: number;
    pgUser: string;
    pgPassword: string;
    pgTemplateDatabase: string;
  }
}

const TEMPLATE_DATABASE = "buycarmap_template";

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let container: StartedPostgreSqlContainer;
  try {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase(TEMPLATE_DATABASE)
      .withUsername("postgres")
      .withPassword("postgres")
      .start();
  } catch (error) {
    // Edge case (docs/specs/core-testing.md): never skip silently — Docker
    // Desktop not running must fail loudly, here, rather than as a confusing
    // connection error from the first test that tries to use the database.
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Integration tests need Docker Desktop running: ${reason}`);
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    shell: process.platform === "win32",
  });

  project.provide("pgHost", container.getHost());
  project.provide("pgPort", container.getPort());
  project.provide("pgUser", container.getUsername());
  project.provide("pgPassword", container.getPassword());
  project.provide("pgTemplateDatabase", container.getDatabase());

  return async () => {
    await container.stop();
  };
}
