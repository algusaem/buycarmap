import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// The DB-gated auth tests (register/login round-trip) run only when E2E_DB=1,
// and then the dev server needs the real Neon connection + a stable secret.
// Otherwise the app runs against a throwaway URL (no real persistence needed).
const dbEnabled = !!process.env.E2E_DB;
const serverEnv = dbEnabled
  ? {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret",
      NEXTAUTH_URL: "http://localhost:3000",
    }
  : {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      NEXTAUTH_SECRET: "e2e-secret",
      NEXTAUTH_URL: "http://localhost:3000",
    };

// E2E runs against a real Next dev server; the two source proxies are mocked at
// the browser level (see e2e/fixtures/network.ts) so runs never hit the live
// Wallapop/coches.net APIs. Visual tests live in their own project so their
// pixel diffs never gate functional PRs.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The DB-gated auth flows compile server actions + NextAuth routes on demand
  // and open real DB connections; many workers hitting the single dev server at
  // once starves it. Run serially when the DB suite is enabled.
  workers: process.env.E2E_DB ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
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
    {
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: serverEnv,
  },
});
