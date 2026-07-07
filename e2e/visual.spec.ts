import { test, expect } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

// Screenshot baselines. Runs only in the "visual" Playwright project so pixel
// diffs never gate functional PRs. Generate/update baselines with:
//   npx playwright test --project=visual --update-snapshots
test("login page visual baseline", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveScreenshot("login.png", { fullPage: true });
});

test("map page visual baseline", async ({ page }) => {
  await mockListingSources(page);
  await page.goto("/map");
  await page.getByText("Audi A3 2.0 TDI").waitFor();
  // Mask the map tiles — they load asynchronously and aren't pixel-stable.
  await expect(page).toHaveScreenshot("map.png", {
    mask: [page.locator(".leaflet-container")],
  });
});
