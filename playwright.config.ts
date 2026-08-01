import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// The DB-gated auth tests (register/login round-trip) run only when E2E_DB=1,
// and then the dev server needs the real Neon connection + a stable secret.
// Otherwise the app runs against a throwaway URL (no real persistence needed).
const dbEnabled = !!process.env.E2E_DB;

// Throwaway, but at least 32 characters: lib/env.ts logs a security warning
// below that length, and a warning on every e2e run trains people to ignore it.
const E2E_FALLBACK_SECRET = "e2e-secret-at-least-32-characters-long";
const serverEnv = dbEnabled
  ? {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? E2E_FALLBACK_SECRET,
      NEXTAUTH_URL: "http://localhost:3000",
    }
  : {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      NEXTAUTH_SECRET: E2E_FALLBACK_SECRET,
      NEXTAUTH_URL: "http://localhost:3000",
    };

// E2E runs against a real Next dev server; the two source proxies are mocked at
// the browser level (see e2e/fixtures/network.ts) so runs never hit the live
// Wallapop/coches.net APIs. Visual tests live in their own project so their
// pixel diffs never gate functional PRs.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Every project shares ONE `next dev` server. Past two workers, the browsers
  // and the dev server contend for the same cores and tests start failing on
  // timing alone — the same tests pass in isolation. Measured on this suite:
  // 4 workers took 2.1 min with 5 failures, 2 workers 13.5 s with none.
  //
  // Capping concurrency is the fix rather than raising timeouts, which would
  // only turn flakes into slow flakes.
  //
  // The DB-gated flows additionally open real connections, so they run serially.
  workers: process.env.E2E_DB ? 1 : 2,
  forbidOnly: !!process.env.CI,
  // One local retry so a machine-contention flake is reported as "flaky"
  // rather than "failed". Playwright still lists every retried test, so this
  // classifies the noise instead of hiding it — a genuinely broken test fails
  // both attempts and still goes red.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  // Pre-compiles every route so no test pays the cold-start cost. See the file.
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /visual\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /(map|auth)\.spec\.ts/,
    },
    // NOTE: this project is flaky for reasons that predate the auth work — the
    // auth pages animate in and the map renders live CARTO tiles, so a
    // screenshot catches whichever frame it lands on. Emulating
    // prefers-reduced-motion was tried and did not settle it. Deliberately
    // excluded from `pnpm test:e2e` so pixel noise never gates a PR.
    {
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: serverEnv,
  },
});
