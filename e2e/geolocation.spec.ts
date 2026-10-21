import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

// docs/specs/map-and-search.md (MAP-32, MAP-34, issue #117): with the browser's
// position granted, it stands in for a place on /map. Madrid's fix
// (40.4168, −3.7038) is rounded to (40.42, −3.70) before it leaves the browser
// (MAP-35). Only the "chromium" project runs this file: its name matches
// neither the "mobile" project's testMatch nor the WebKit projects'
// (playwright.config.ts), so the phone summary is covered at component level
// (components/map/MapView.test.tsx) rather than here. `es-ES` makes the page
// render in Spanish, the default locale (FRONT-9), whatever the device sends.
test.use({
  geolocation: { latitude: 40.4168, longitude: -3.7038 },
  permissions: ["geolocation"],
  locale: "es-ES",
});

test.beforeEach(async ({ page }) => {
  await mockListingSources(page);
});

// The «Dónde» segment once the position stands in: «Tu ubicación · 50 km»,
// with the U+00A0 the messages put before «km» (\s matches it).
const YOUR_LOCATION = /Tu ubicación · 50\skm/;

async function openWithPosition(page: Page) {
  await page.goto("/map");
  await expect(page.getByRole("button", { name: YOUR_LOCATION })).toBeVisible();
}

test("MAP-32: with geolocation granted, /map reads «Tu ubicación · 50 km» and keeps the position out of the URL", async ({
  page,
}) => {
  await openWithPosition(page);

  // MAP-33: neither the position nor its radius reaches the URL.
  for (const param of ["lat=", "lng=", "placeId=", "locationName=", "radius="]) {
    expect(page.url()).not.toContain(param);
  }
});

test("MAP-34: with geolocation granted, the map frames the 50 km circle around the position", async ({
  page,
}) => {
  await openWithPosition(page);

  // Hand-derived: the circle's bounds run from 39.9703 to 40.8697 in latitude
  // and are symmetric about −3.70 in longitude; their middle on MapLibre's
  // Mercator projection is 40.4215. The default scenario's one pin inside the
  // circle (Wallapop's, at 40.4168, −3.7038, e2e/fixtures/network.ts) fitted
  // alone would centre on itself at the maximum zoom of 13, so a centre within
  // 0.002° of (40.4215, −3.7000) below zoom 13 is the circle being framed.
  const mapEl = page.locator('[data-map="listings"]');
  await expect
    .poll(async () => {
      const center = (await mapEl.getAttribute("data-map-center")) ?? "";
      const zoom = Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN);
      const [lat, lng] = center.split(",").map(Number);
      return Math.abs(lat - 40.4215) < 0.002 && Math.abs(lng + 3.7) < 0.002 && zoom < 13;
    })
    .toBe(true);
});

test("MAP-32: /map with the position standing in has no accessibility violations", async ({
  page,
}) => {
  await openWithPosition(page);

  // The same bar as e2e/a11y.spec.ts: no serious or critical violation.
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
