import { defineConfig, devices } from "@playwright/test";
import { withGuidepup } from "@guidepup/playwright";
import e2eConfig from "./playwright.config";

// docs/specs/a11y-checks.md (A11Y-9 to A11Y-14); ADR 0024. The NVDA
// screen-reader suite, run by `pnpm test:sr` on the Windows CI runner
// (.github/workflows/screen-reader.yml), never by `pnpm test:e2e` or
// `pnpm check:full`. Guidepup drives one real NVDA, so the run is serial and
// headed (`withGuidepup`), with one worker. The app is served exactly as for
// the e2e suite: the same web servers (the mock upstreams and `pnpm dev`),
// base URL and route warm-up, taken from playwright.config.ts.
export default defineConfig(
  withGuidepup({
    testDir: "./e2e-sr",
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    // No retries, as in the e2e suite: a flaky test is a broken test (STACK.md §16).
    retries: 0,
    reporter: process.env.CI ? [["html"], ["list"]] : "list",
    // Each NVDA command waits for the speech it causes to settle, so a walk
    // of up to MAX_NVDA_STOPS `next()` calls outlasts the default 30s; a
    // timeout mid-walk tears NVDA down and reads as «NVDA is not running».
    timeout: 180_000,
    globalSetup: e2eConfig.globalSetup,
    // The assertions read BuyCarMap's Spanish strings, and the app picks its
    // language from Accept-Language: the runner's English browser would get
    // the English pages (the skip link spoken as «Skip to content»).
    use: { ...e2eConfig.use, locale: "es-ES" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: e2eConfig.webServer,
  }),
);
