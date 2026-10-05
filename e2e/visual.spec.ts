import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { visualBaselineSkipReason } from "./fixtures/visual-baseline";

const SNAPSHOT_DIR = path.join(process.cwd(), "e2e", "visual.spec.ts-snapshots");

/**
 * Whether a baseline exists for the platform currently running.
 *
 * Font rasterisation differs per OS, so a Windows baseline can never match a
 * Linux run. Rather than excluding these tests wholesale — which hid them and
 * let them rot — each one skips with an explicit reason when its own platform
 * has no baseline yet, and runs normally as soon as one is committed — or
 * when the run is updating snapshots, so the missing one can be written
 * (TEST-15).
 */
function hasBaseline(name: string): boolean {
  return fs.existsSync(path.join(SNAPSHOT_DIR, `${name}-visual-${process.platform}.png`));
}

/** TEST-15: skips with a reason when this platform has no baseline to compare. */
function skipWithoutBaseline(name: string) {
  const reason = visualBaselineSkipReason({
    name,
    platform: process.platform,
    updateSnapshots: test.info().config.updateSnapshots,
    baselineExists: hasBaseline(name),
  });
  if (reason !== null) test.skip(true, reason);
}

// Screenshot baselines. Generate/update with:
//   pnpm test:visual --update-snapshots
//
// Baselines are platform-suffixed (`-win32`, `-linux`) because font
// rasterisation differs per OS — regenerate on the platform you run on.

/**
 * Waits until the page is actually stable enough to photograph.
 *
 * Two independent races, both found by reading the diff images rather than
 * guessing:
 *
 * 1. The navbar renders an animated placeholder while `useSession()` loads and
 *    only then swaps in the real links (the theme and language switchers
 *    likewise wait on `useMounted`). Screenshots caught whichever half had
 *    landed — the map diff was confined to the top-right corner.
 * 2. `next/font` loads Plus Jakarta Sans asynchronously. Until it arrives, text
 *    renders in the fallback face, and the glyph shapes differ. This only
 *    showed up once every project ran together and the machine was loaded
 *    enough to lose the race — the diff was the wordmark's letterforms.
 */
async function waitForPageToSettle(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /sign in|entrar/i })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test("TEST-15: login page visual baseline", async ({ page }) => {
  skipWithoutBaseline("login");

  await page.goto("/login");
  await waitForPageToSettle(page);
  await expect(page).toHaveScreenshot("login.png", { fullPage: true });
});

test("TEST-15: map page visual baseline", async ({ page }) => {
  skipWithoutBaseline("map");

  await mockListingSources(page);
  await page.goto("/map");
  await page.getByText("Audi A3 2.0 TDI").waitFor();
  await waitForPageToSettle(page);
  // Mask the map tiles — they load asynchronously and aren't pixel-stable.
  await expect(page).toHaveScreenshot("map.png", {
    mask: [page.locator(".leaflet-container")],
  });
});
