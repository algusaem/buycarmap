import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { mockListingSources, setUpstreamScenario } from "./fixtures/network";

// FRONT-22 (docs/specs/core-frontend.md): this is the only file that ever
// asks the mock upstream server (e2e/fixtures/upstream-server.ts) for a
// scenario other than "default" — the single shared server every worker
// talks to, same as the single shared `pnpm dev` server. Serial mode keeps
// this file's own "empty" and "default" tests from interleaving with each
// other, and the afterEach reset leaves the server back on "default" for
// whatever runs next. Only this file needs either: every other spec only
// ever asks for "default", so nothing else can race it — and in a plain
// `pnpm test:e2e` run every test below skips itself (SCREENSHOTS unset)
// before it ever switches the scenario, so there is nothing to race there
// either. The documented standalone invocation below is the only way this
// file actually runs with SCREENSHOTS=1.
test.describe.configure({ mode: "serial" });
test.afterEach(async () => {
  // Every test below skips itself first when SCREENSHOTS is unset, so this
  // guard keeps a plain `pnpm test:e2e` run from adding an unnecessary round
  // trip to the mock upstream server for tests that never switched it away
  // from "default" in the first place.
  if (process.env.SCREENSHOTS) await setUpstreamScenario("default");
});

// FRONT-20 (docs/specs/core-frontend.md): screenshots, on mobile and
// desktop, of every surface whose look changes through FRONT-14 (the four
// list states), FRONT-18 (Impeccable's detector findings fixed) or FRONT-19
// (contrast adjustments) — for the owner to confirm before the commit
// (RULES.md §22 item 5). Not run as part of this change (brief: "Do not run
// it"); see "How to run" below.
//
// Excluded from `pnpm test:e2e` without touching playwright.config.ts (a
// config change outside this brief's authorised stubs, RULES.md §1): rather
// than mirroring `visual.spec.ts`'s project-level `testMatch`/`testIgnore`
// split, every test calls `test.skip(...)` on itself unless `SCREENSHOTS=1`
// is set. Kept as plain `test(...)` calls, not a renamed wrapper, because
// `pnpm spec:check` (scripts/spec-check.mjs) only recognises criterion ids in
// titles passed to literal `it`/`test`/`dbTest` calls.
//
// How to run (after the FRONT-14/18/19 UI work lands):
//   SCREENSHOTS=1 pnpm exec playwright test e2e/screenshots.spec.ts --project=chromium
//
// Until then every test below is expected to skip or fail — there is no
// Impeccable output, no contrast fix and no list-state UI to photograph yet.

const OUT_DIR = path.join(process.cwd(), "test-results", "screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${device}`, () => {
    test.use({ viewport });

    // FRONT-14: the four list states. Loading/error/populated/empty are not
    // yet a decided prop surface on MapView/FavoritesList/AlertsList/
    // AlertMatchesList (not in this brief's "decided surfaces"), so these
    // capture what exists today as placeholders to be replaced once that
    // surface is implemented — each screenshot's name says which state it
    // is meant to become.
    test(`FRONT-20: ${device} map results list — populated`, async ({ page }) => {
      test.skip(!process.env.SCREENSHOTS, "run with SCREENSHOTS=1 (see file header)");
      await mockListingSources(page);
      await page.goto("/map");
      await page.getByText("Audi A3 2.0 TDI").waitFor();
      await shoot(page, `map-results-populated-${device}`);
    });

    test(`FRONT-20: ${device} map results list — empty`, async ({ page }) => {
      test.skip(!process.env.SCREENSHOTS, "run with SCREENSHOTS=1 (see file header)");
      await setUpstreamScenario("empty");
      await page.goto("/map");
      await shoot(page, `map-results-empty-${device}`);
    });

    test(`FRONT-20: ${device} favorites — empty`, async ({ page }) => {
      test.skip(!process.env.SCREENSHOTS, "run with SCREENSHOTS=1 (see file header)");
      await page.goto("/favorites");
      await shoot(page, `favorites-empty-${device}`);
    });

    test(`FRONT-20: ${device} alerts — empty`, async ({ page }) => {
      test.skip(!process.env.SCREENSHOTS, "run with SCREENSHOTS=1 (see file header)");
      await page.goto("/alerts");
      await shoot(page, `alerts-empty-${device}`);
    });

    // FRONT-19: contrast-adjusted routes.
    for (const route of ["/", "/login", "/register"]) {
      test(`FRONT-20: ${device} ${route} after contrast fixes`, async ({ page }) => {
        test.skip(!process.env.SCREENSHOTS, "run with SCREENSHOTS=1 (see file header)");
        await page.goto(route);
        await shoot(page, `${route === "/" ? "home" : route.slice(1)}-${device}`);
      });
    }
  });
}
