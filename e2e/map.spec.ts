import { test, expect } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

test.beforeEach(async ({ page }) => {
  await mockListingSources(page);
});

test("renders interleaved listings from all sources on the map page", async ({
  page,
}) => {
  await page.goto("/map");

  // One listing from each source proves the three-way fan-out renders.
  await expect(
    page.getByText("Audi A3 2.0 TDI", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("BMW Serie 3 320d", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("SEAT León 1.5 TSI", { exact: false }),
  ).toBeVisible();
});

test("renders the Leaflet map surface", async ({ page, isMobile }) => {
  // On mobile the map lives behind MobileMapOverlay (tap to open), so the
  // side-by-side surface only shows on wider viewports.
  test.skip(!!isMobile, "map is behind an overlay on mobile");
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("keeps results after opening the filters panel", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByText("Audi A3 2.0 TDI")).toBeVisible();

  const filtersToggle = page.getByRole("button", { name: /filter/i }).first();
  if (await filtersToggle.isVisible().catch(() => false)) {
    await filtersToggle.click();
  }

  // Results remain rendered while filtering UI is open.
  await expect(page.getByText("Audi A3 2.0 TDI")).toBeVisible();
});
