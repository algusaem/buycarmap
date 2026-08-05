import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// The DB-gated auth tests (register/login round-trip) run only when E2E_DB=1,
// and then the dev server needs the real Neon connection + a stable secret.
// Otherwise the app runs against a throwaway URL (no real persistence needed).
const dbEnabled = !!process.env.E2E_DB;

// The suite defaults to 3000 and can be moved with E2E_PORT when something else
// already owns it. This is not just convenience: `reuseExistingServer` is on
// outside CI, so an unrelated app answering on 3000 is silently adopted as "the
// dev server" and every assertion runs against someone else's HTML. Moving the
// port is the difference between a real run and a wall of nonsense failures.
const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;

// Throwaway, but at least 32 characters: lib/env.ts logs a security warning
// below that length, and a warning on every e2e run trains people to ignore it.
const E2E_FALLBACK_SECRET = "e2e-secret-at-least-32-characters-long";

// Registration behaves completely differently depending on whether email is
// configured: verify-first (no account until a link is clicked) when it is,
// immediate creation reporting `emailTaken` when it is not. The DB-gated
// register tests exercise the second path.
//
// `webServer.env` MERGES with process.env, and line 1 loads .env into it, so
// the mode was decided by whatever happened to be in the developer's .env
// rather than by this file. That went unnoticed until `pnpm db:branch` started
// copying RESEND_API_KEY into every worktree, at which point both register
// tests failed against behaviour the app is specified to have. Blanking the
// pair here makes the mode a property of the test setup instead of the machine.
// `isEmailConfigured` is a Boolean() of both values, so "" reads as unset.
const NO_EMAIL = { RESEND_API_KEY: "", EMAIL_FROM: "" };

const serverEnv = dbEnabled
  ? {
      ...NO_EMAIL,
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? E2E_FALLBACK_SECRET,
      NEXTAUTH_URL: BASE_URL,
    }
  : {
      ...NO_EMAIL,
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      NEXTAUTH_SECRET: E2E_FALLBACK_SECRET,
      NEXTAUTH_URL: BASE_URL,
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
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: {
      // A small budget for rasterisation noise, calibrated against measurements
      // rather than guessed. On a ~920k-pixel screenshot the residual diff
      // between two identical renders is ~86px, all of it antialiasing on the
      // blurred gradient orbs. Real regressions measured during this work were
      // far larger: a navbar caught mid-session-load differed by 2,606px, and a
      // fallback font by over 20,000. 300 sits ~3x above the noise and ~9x
      // below the smallest genuine change, so it absorbs the former without
      // ever hiding the latter.
      maxDiffPixels: 300,
    },
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
      testMatch: /(map|auth|navbar)\.spec\.ts/,
    },
    // Runs as part of `pnpm test:e2e` like everything else. It used to be
    // excluded as "inherently flaky"; it wasn't — the screenshots were racing
    // the navbar's session placeholder and next/image fetching fixture URLs
    // that 404. Both are fixed at the source. Each test skips itself with a
    // reason when the current platform has no baseline, so a Linux CI stays
    // green until Linux baselines are committed.
    {
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // PORT goes through the env object rather than inline in `command`, which
    // would be POSIX-only syntax and break on Windows. Next reads it directly.
    env: { ...serverEnv, PORT },
  },
});
