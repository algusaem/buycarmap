import fs from "node:fs";
import path from "node:path";
import { test, expect, Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

const SNAPSHOT_DIR = path.join(
  process.cwd(),
  "e2e",
  "visual.spec.ts-snapshots",
);

/**
 * Whether a baseline exists for the platform currently running.
 *
 * Font rasterisation differs per OS, so a Windows baseline can never match a
 * Linux run. Rather than excluding these tests wholesale — which hid them and
 * let them rot — each one skips with an explicit reason when its own platform
 * has no baseline yet, and runs normally as soon as one is committed.
 */
function hasBaseline(name: string): boolean {
  return fs.existsSync(
    path.join(SNAPSHOT_DIR, `${name}-visual-${process.platform}.png`),
  );
}

const missingBaseline = (name: string) =>
  `No ${process.platform} baseline for "${name}". Generate one on this platform with: pnpm test:visual --update-snapshots`;

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

test("login page visual baseline", async ({ page }) => {
  test.skip(!hasBaseline("login"), missingBaseline("login"));

  await page.goto("/login");
  await waitForPageToSettle(page);
  await expect(page).toHaveScreenshot("login.png", { fullPage: true });
});

test("map page visual baseline", async ({ page }) => {
  test.skip(!hasBaseline("map"), missingBaseline("map"));

  await mockListingSources(page);
  await page.goto("/map");
  await page.getByText("Audi A3 2.0 TDI").waitFor();
  await waitForPageToSettle(page);
  // Mask the map tiles — they load asynchronously and aren't pixel-stable.
  await expect(page).toHaveScreenshot("map.png", {
    mask: [page.locator(".leaflet-container")],
  });
});
