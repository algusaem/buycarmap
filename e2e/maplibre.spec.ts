import { test, expect, type Page } from "@playwright/test";
import {
  e2eEmail,
  seedAlertMatches,
  seedAlerts,
  seedFavorites,
  seedUser,
  type SeedAlert,
  type SeedAlertMatch,
  type SeedFavorite,
} from "./fixtures/db";
import { dragDown } from "./fixtures/drag";
import { box } from "./fixtures/measure";
import { mockListingSources } from "./fixtures/network";
import { signIn, waitForSession } from "./fixtures/session";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md (Key MAPLIBRE, criteria MAPLIBRE-3 to MAPLIBRE-10,
// MAPLIBRE-14, MAPLIBRE-15): the map engine swap from Leaflet/CARTO to
// MapLibre GL/OpenFreeMap, proven the way e2e/map.spec.ts and
// e2e/alerts-ui.spec.ts prove the map's existing behaviour — a real browser,
// stubbed sources, no network reaching the real marketplaces or tile host.
//
// None of the `data-map`/`data-map-center`/`data-map-zoom`/`data-map-bearing`/
// `data-map-pitch` hooks this file reads exist yet (grep confirms it): the
// engine has not been swapped, so every assertion below is expected to fail
// — on the missing hook or behaviour, never on a syntax or fixture error.
// `ATTR_TIMEOUT` keeps each of those failures a few seconds rather than the
// default 30s test timeout, since the element they wait for never appears.
const ATTR_TIMEOUT = 5000;

const DESKTOP_1440 = { width: 1440, height: 900 };
const PHONE_390 = { width: 390, height: 844 };

const PASSWORD = "harbour-lentil-quilt-97";
const dbTest = process.env.E2E_DB ? test : test.skip;

// `e2e/playwright.config.ts`'s "mobile" project restricts itself to files
// whose name ends in "map.spec.ts", "auth.spec.ts" or "navigation.spec.ts"
// (testMatch). "maplibre.spec.ts" does not match that pattern (confirmed
// with `playwright test e2e/maplibre.spec.ts --project=mobile --list`,
// which lists 0 tests) — a pre-existing config fact, not something this
// change may fix (CLAUDE.md: no config changes in this brief). Every case
// below that the spec asks for "on the mobile project" instead runs under
// "chromium" with the phone viewport set by hand, the same way
// e2e/alerts-ui.spec.ts's own phone-width cases do.

/** The centre pixel of a 10x10 clip around (x, y), decoded in the browser. */
async function readPixel(
  page: Page,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number }> {
  const clip = { x: Math.round(x) - 5, y: Math.round(y) - 5, width: 10, height: 10 };
  const screenshot = await page.screenshot({ clip });
  const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;

  const [r, g, b] = await page.evaluate(async (src) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("failed to decode the clipped screenshot"));
      image.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d canvas context");
    context.drawImage(image, 0, 0);
    const pixel = context.getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      1,
      1,
    ).data;
    return [pixel[0], pixel[1], pixel[2]];
  }, dataUrl);

  return { r, g, b };
}

/** Sets the `locale` cookie `lib/i18n/config.ts` reads, before any navigation. */
async function setLocale(page: Page, locale: "en" | "es"): Promise<void> {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("setLocale needs the project's baseURL");
  await page.context().addCookies([{ name: "locale", value: locale, url: baseURL }]);
}

/**
 * Overrides `HTMLCanvasElement.prototype.getContext` so every WebGL context
 * request returns null, as a browser with WebGL disabled or unavailable
 * would (MAPLIBRE-15). Other context kinds (e.g. "2d") call through.
 */
async function disableWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const BLOCKED_CONTEXTS: ReadonlySet<string> = new Set([
      "webgl",
      "webgl2",
      "experimental-webgl",
    ]);
    const original = HTMLCanvasElement.prototype.getContext;
    function patchedGetContext(
      this: HTMLCanvasElement,
      contextId: string,
      options?: Record<string, unknown>,
    ): RenderingContext | null {
      if (BLOCKED_CONTEXTS.has(contextId)) return null;
      return original.call(this, contextId, options);
    }
    HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof original;
  });
}

/** An alert whose criteria hold a place, so it has a zone (lib/map/zone.ts's `alertMapZone`). */
const ZONE_ALERT: SeedAlert = {
  label: "Alerta con zona",
  criteria: {
    brand: "Toyota",
    model: "Corolla",
    latitude: 40.4168,
    longitude: -3.7038,
    distanceInKm: 50,
  },
  placeName: "Madrid",
  createdAt: new Date("2026-10-15T10:00:00Z"),
};

test.describe("MAPLIBRE-3: the default view, before any search narrows it", () => {
  test("MAPLIBRE-3: at 1440x900 on /map with an empty search, the map centres on Spain at zoom 5, the ground pixel is rgb(20, 20, 22), and no request names cartocdn.com", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);

    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));

    // Zero results under the "default" scenario instead of switching to
    // "empty" (which races other spec files sharing the mock upstream
    // server's one global scenario, e2e/fixtures/upstream-server.ts:32-36):
    // `model=Corolla` doesn't match any default-scenario listing's model or
    // title ("Audi A3 2.0 TDI", "BMW Serie 3 320d", "SEAT León 1.5 TSI" —
    // e2e/fixtures/network.ts's wallapopFixture/cochesNetFixture/
    // milanunciosFixture), so lib/listings/merge.ts's filterByModel drops
    // all three.
    await page.goto("/map?model=Corolla");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toHaveAttribute("data-map-center", "40.4168,-3.7038", {
      timeout: ATTR_TIMEOUT,
    });
    await expect(mapEl).toHaveAttribute("data-map-zoom", "5", { timeout: ATTR_TIMEOUT });

    const mapBox = await box(mapEl);
    const pixel = await readPixel(page, mapBox.x + 40, mapBox.y + mapBox.height / 2);
    expect(pixel).toEqual({ r: 20, g: 20, b: 22 });

    expect(requestUrls.some((url) => url.includes("cartocdn.com"))).toBe(false);
  });
});

test.describe("MAPLIBRE-4: panning and zooming never rotate or tilt the map", () => {
  test("MAPLIBRE-4: a right-button drag and a Ctrl-drag both leave bearing and pitch at 0", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    const mapBox = await box(mapEl);
    const cx = mapBox.x + mapBox.width / 2;
    const cy = mapBox.y + mapBox.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(cx + 200, cy, { steps: 10 });
    await page.mouse.up({ button: "right" });
    await expect(mapEl).toHaveAttribute("data-map-bearing", "0", { timeout: ATTR_TIMEOUT });
    await expect(mapEl).toHaveAttribute("data-map-pitch", "0", { timeout: ATTR_TIMEOUT });

    await page.keyboard.down("Control");
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(mapEl).toHaveAttribute("data-map-bearing", "0", { timeout: ATTR_TIMEOUT });
    await expect(mapEl).toHaveAttribute("data-map-pitch", "0", { timeout: ATTR_TIMEOUT });
  });

  // The brief's fallback for when the "mobile" project cannot run this file
  // (it cannot: see the header comment): a desktop page given a touch-capable
  // context, rotating two synthetic touch points with the CDP
  // `Input.dispatchTouchEvent` command, which only a Chromium-based browser
  // (every project here) exposes.
  test("MAPLIBRE-4: a two-finger twist on a touch-capable page leaves bearing and pitch at 0", async ({
    browser,
  }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: DESKTOP_1440 });
    const page = await context.newPage();
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    const mapBox = await box(mapEl);
    const centreX = Math.round(mapBox.x + mapBox.width / 2);
    const centreY = Math.round(mapBox.y + mapBox.height / 2);
    const radius = 40;

    const cdp = await context.newCDPSession(page);
    // Two points, 80px apart, rotated 45° about the map's centre: a twist
    // gesture. dispatchTouchEvent takes absolute viewport coordinates.
    const start = [
      { x: centreX - radius, y: centreY, id: 1 },
      { x: centreX + radius, y: centreY, id: 2 },
    ];
    const end = [
      {
        x: centreX - Math.round(radius * Math.SQRT1_2),
        y: centreY - Math.round(radius * Math.SQRT1_2),
        id: 1,
      },
      {
        x: centreX + Math.round(radius * Math.SQRT1_2),
        y: centreY + Math.round(radius * Math.SQRT1_2),
        id: 2,
      },
    ];

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: start.map((point) => ({ x: point.x, y: point.y, id: point.id })),
    });
    for (let step = 1; step <= 5; step++) {
      const t = step / 5;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: start.map((point, index) => ({
          x: Math.round(point.x + (end[index].x - point.x) * t),
          y: Math.round(point.y + (end[index].y - point.y) * t),
          id: point.id,
        })),
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(mapEl).toHaveAttribute("data-map-bearing", "0", { timeout: ATTR_TIMEOUT });
    await expect(mapEl).toHaveAttribute("data-map-pitch", "0", { timeout: ATTR_TIMEOUT });
    await context.close();
  });
});

test.describe("MAPLIBRE-5: OpenFreeMap's required attribution", () => {
  test("MAPLIBRE-5: the attribution control names OpenFreeMap, OpenMapTiles and OpenStreetMap as links, bottom-right, in surface/text-muted", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    const attribution = mapEl.locator(".maplibregl-ctrl-attrib");
    await expect(attribution).toBeVisible({ timeout: ATTR_TIMEOUT });

    await expect(attribution).toContainText("OpenFreeMap");
    await expect(attribution).toContainText("OpenMapTiles");
    await expect(attribution).toContainText("OpenStreetMap");

    const openFreeMapLink = attribution.getByRole("link", { name: /OpenFreeMap/ });
    const openMapTilesLink = attribution.getByRole("link", { name: /OpenMapTiles/ });
    const openStreetMapLink = attribution.getByRole("link", { name: /OpenStreetMap/ });
    await expect(openFreeMapLink).toHaveAttribute("href", /^https:\/\/openfreemap\.org/);
    await expect(openMapTilesLink).toHaveAttribute("href", /^https:\/\/www\.openmaptiles\.org/);
    await expect(openStreetMapLink).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org/);

    // docs/design/system/tokens.json: surface #18181B = rgb(24, 24, 27),
    // text-muted #A3A0A6 = rgb(163, 160, 166) — verified against the token
    // file by lib/map/style.test.ts's own cross-check.
    await expect(attribution).toHaveCSS("background-color", "rgb(24, 24, 27)");
    await expect(attribution).toHaveCSS("color", "rgb(163, 160, 166)");

    const attrBox = await box(attribution);
    const mapBox = await box(mapEl);
    expect(
      Math.abs(mapBox.x + mapBox.width - (attrBox.x + attrBox.width)),
      "attribution right edge within 16px of the map's right edge",
    ).toBeLessThanOrEqual(16);
    expect(
      Math.abs(mapBox.y + mapBox.height - (attrBox.y + attrBox.height)),
      "attribution bottom edge within 16px of the map's bottom edge",
    ).toBeLessThanOrEqual(16);
  });

  // ALERTUI-24: the phone zone preview's attribution is plain text, no link,
  // nothing focusable — kept on this engine, with the same three names.
  // docs/specs/map-maplibre.md puts this under "/alerts" (the alerts list);
  // the actual phone zone preview (ZoneMapCanvas, via AlertZoneMap) only
  // renders on an alert's own page (components/alerts/AlertPage.tsx,
  // `isPhone && zone && zoneLabel`), confirmed by grepping app/alerts for
  // AlertZoneMap/ZoneMapCanvas (components/alerts/AlertPage.tsx only) — so
  // this navigates to /alerts/[id], not /alerts.
  dbTest(
    "MAPLIBRE-5: on a phone, an alert's zone preview keeps plain-text attribution naming OpenFreeMap, OpenMapTiles and OpenStreetMap, with no link and nothing focusable",
    async ({ page }) => {
      const email = e2eEmail("maplibre5-zone");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [ZONE_ALERT]);
      await stubMapTiles(page);
      await mockListingSources(page);
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);

      await page.goto(`/alerts/${alertId}`);
      await waitForSession(page);

      const zone = page.locator('[data-map="zone"]');
      await expect(zone).toBeVisible({ timeout: ATTR_TIMEOUT });
      await expect(zone).toContainText("OpenFreeMap");
      await expect(zone).toContainText("OpenMapTiles");
      await expect(zone).toContainText("OpenStreetMap");
      expect(await zone.locator("a").count()).toBe(0);
      expect(await zone.locator('a, button, input, [tabindex]:not([tabindex="-1"])').count()).toBe(
        0,
      );
    },
  );
});

test.describe("MAPLIBRE-6: every existing map behaviour, ported to MapLibre", () => {
  test("MAPLIBRE-6: the MapLibre canvas and 3 price pins render; a pin's preview opens on click, Escape closes it and returns focus; the zoom buttons change data-map-zoom by exactly 1", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    await expect(mapEl.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: ATTR_TIMEOUT });

    // The default stub: Audi in Madrid (40.4168,-3.7038, Wallapop's exact
    // coordinates), BMW in Barcelona (coches.net, city-level approximation)
    // and SEAT in Seville (Milanuncios, city-level approximation) — three
    // different cities, so three different approximate points. MAP-15 groups
    // a pin only for listings that share the exact same point, so this is 3
    // pins, not fewer (e2e/map.spec.ts's "renders interleaved listings from
    // all sources" already shows each as its own named pin today).
    const pins = mapEl.locator(".maplibregl-marker");
    await expect(pins).toHaveCount(3, { timeout: ATTR_TIMEOUT });

    const firstPin = pins.first().getByRole("button");
    await firstPin.click();
    const preview = page.getByRole("article", { name: /vista previa del coche|car preview/i });
    await expect(preview).toBeVisible({ timeout: ATTR_TIMEOUT });

    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(firstPin).toBeFocused();

    const zoomBefore = Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN);
    await page.getByRole("button", { name: /^(acercar|zoom in)$/i }).click();
    await expect
      .poll(async () => Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN), {
        timeout: ATTR_TIMEOUT,
      })
      .toBe(zoomBefore + 1);

    const zoomAfterIn = Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN);
    await page.getByRole("button", { name: /^(alejar|zoom out)$/i }).click();
    await expect
      .poll(async () => Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN), {
        timeout: ATTR_TIMEOUT,
      })
      .toBe(zoomAfterIn - 1);
  });

  const FAV_CAR_1: SeedFavorite = {
    listingId: "maplibre-fav-1",
    title: "Favorito Uno",
    price: 10000,
    mileage: 50000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
    savedAt: new Date("2026-10-15T09:00:00Z"),
  };
  const FAV_CAR_2: SeedFavorite = {
    listingId: "maplibre-fav-2",
    title: "Favorito Dos",
    price: 12000,
    mileage: 60000,
    location: "Barcelona",
    lat: 41.3874,
    lng: 2.1686,
    savedAt: new Date("2026-10-15T09:05:00Z"),
  };

  dbTest(
    "MAPLIBRE-6: /favorites with 2 saved cars at different points shows the MapLibre canvas and 2 pins",
    async ({ page }) => {
      const email = e2eEmail("maplibre6-favorites");
      await seedUser(email, PASSWORD);
      await seedFavorites(email, [FAV_CAR_1, FAV_CAR_2]);
      await stubMapTiles(page);
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);

      await page.goto("/favorites");
      await waitForSession(page);

      const mapEl = page.locator('[data-map="listings"]');
      await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
      await expect(mapEl.locator("canvas.maplibregl-canvas")).toBeVisible({
        timeout: ATTR_TIMEOUT,
      });
      await expect(mapEl.locator(".maplibregl-marker")).toHaveCount(2, { timeout: ATTR_TIMEOUT });
    },
  );

  const ALERT_MATCH_1: SeedAlertMatch = {
    listingId: "maplibre-match-1",
    title: "Coincidencia Uno",
    price: 11000,
    mileage: 40000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
    createdAt: new Date("2026-10-15T09:00:00Z"),
  };
  const ALERT_MATCH_2: SeedAlertMatch = {
    listingId: "maplibre-match-2",
    title: "Coincidencia Dos",
    price: 13000,
    mileage: 45000,
    location: "Valencia",
    lat: 39.4699,
    lng: -0.3763,
    createdAt: new Date("2026-10-15T09:05:00Z"),
  };

  dbTest(
    "MAPLIBRE-6: /alerts/[id] with 2 matches at different points shows the MapLibre canvas and 2 pins",
    async ({ page }) => {
      const email = e2eEmail("maplibre6-alert");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [
        {
          label: "Alerta mapa",
          criteria: { brand: "Toyota" },
          createdAt: new Date("2026-10-15T08:00:00Z"),
        },
      ]);
      await seedAlertMatches(alertId, [ALERT_MATCH_1, ALERT_MATCH_2]);
      await stubMapTiles(page);
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);

      await page.goto(`/alerts/${alertId}`);
      await waitForSession(page);

      const mapEl = page.locator('[data-map="listings"]');
      await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
      await expect(mapEl.locator("canvas.maplibregl-canvas")).toBeVisible({
        timeout: ATTR_TIMEOUT,
      });
      await expect(mapEl.locator(".maplibregl-marker")).toHaveCount(2, { timeout: ATTR_TIMEOUT });
    },
  );
});

test.describe("MAPLIBRE-7: a new search fits its first results, max zoom 13; an empty one resets to the default view", () => {
  test("MAPLIBRE-7: results across Madrid, Barcelona and Seville fit at zoom 13 or lower, every pin inside a 40px inset", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    await expect
      .poll(async () => Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN), {
        timeout: ATTR_TIMEOUT,
      })
      .toBeLessThanOrEqual(13);

    const mapBox = await box(mapEl);
    const inset = {
      x: mapBox.x + 40,
      y: mapBox.y + 40,
      width: mapBox.width - 80,
      height: mapBox.height - 80,
    };

    const pins = mapEl.locator(".maplibregl-marker");
    const count = await pins.count();
    expect(count, "at least one pin rendered").toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const pinBox = await box(pins.nth(index));
      const centreX = pinBox.x + pinBox.width / 2;
      const centreY = pinBox.y + pinBox.height / 2;
      expect(centreX, `pin ${index} within the left/right 40px inset`).toBeGreaterThanOrEqual(
        inset.x - 1,
      );
      expect(centreX).toBeLessThanOrEqual(inset.x + inset.width + 1);
      expect(centreY, `pin ${index} within the top/bottom 40px inset`).toBeGreaterThanOrEqual(
        inset.y - 1,
      );
      expect(centreY).toBeLessThanOrEqual(inset.y + inset.height + 1);
    }
  });

  test("MAPLIBRE-7: a search with no results resets to the default view (centre 40.4168,-3.7038, zoom 5)", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    // Zero results under the "default" scenario rather than switching to
    // "empty" (see the MAPLIBRE-3 test above for the derivation):
    // `model=Corolla` matches none of the default-scenario listings.
    await page.goto("/map?model=Corolla");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toHaveAttribute("data-map-center", "40.4168,-3.7038", {
      timeout: ATTR_TIMEOUT,
    });
    await expect(mapEl).toHaveAttribute("data-map-zoom", "5", { timeout: ATTR_TIMEOUT });
  });
});

test.describe("MAPLIBRE-8: the pins stay keyboard-operable", () => {
  test("MAPLIBRE-8: Tab reaches a pin; Enter opens its preview at once, Escape closes it and returns focus; Space does the same", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    const firstPin = mapEl.locator(".maplibregl-marker").first().getByRole("button");
    await firstPin.focus({ timeout: ATTR_TIMEOUT });
    await expect(firstPin).toBeFocused();

    const preview = page.getByRole("article", { name: /vista previa del coche|car preview/i });

    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible({ timeout: 100 });
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(firstPin).toBeFocused();

    await page.keyboard.press(" ");
    await expect(preview).toBeVisible({ timeout: 100 });
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(firstPin).toBeFocused();
  });
});

test.describe("MAPLIBRE-9: on a phone, the results sheet and the map never move each other", () => {
  test("MAPLIBRE-9: dragging the sheet's handle does not pan the map; panning the map does not move the sheet", async ({
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(PHONE_390);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    // The map is visible before MapLibre has loaded and fitted the search's
    // results, so the centre is read only once the pins are on the map and
    // two reads apart agree: the settled view the drags must leave alone.
    await expect(mapEl.locator(".maplibregl-marker").first()).toBeAttached({
      timeout: ATTR_TIMEOUT,
    });
    let previousCentre: string | null = null;
    await expect
      .poll(
        async () => {
          const centre = await mapEl.getAttribute("data-map-center");
          const settled = centre !== null && centre === previousCentre;
          previousCentre = centre;
          return settled;
        },
        { timeout: ATTR_TIMEOUT, intervals: [200] },
      )
      .toBe(true);
    const centreBefore = await mapEl.getAttribute("data-map-center");

    const sheet = page.getByTestId("results-sheet");
    const handle = sheet.getByRole("button", { name: /^(lista de resultados|results list)$/i });
    await dragDown(page, handle, -200);
    expect(await mapEl.getAttribute("data-map-center")).toBe(centreBefore);

    const sheetTopBefore = (await box(sheet)).y;
    // A point on the bare map, above the sheet and clear of any pin.
    await page.mouse.move(195, 120);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(195 + step * 10, 120);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    const sheetTopAfter = (await box(sheet)).y;
    expect(Math.abs(sheetTopAfter - sheetTopBefore)).toBeLessThanOrEqual(1);
  });
});

test.describe("MAPLIBRE-10: maplibre-gl loads only on a page that shows a map", () => {
  async function requestedUrls(page: Page, path: string): Promise<string[]> {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    return urls;
  }

  test("MAPLIBRE-10: / requests no MapLibre script", async ({ page }) => {
    const urls = await requestedUrls(page, "/");
    expect(urls.some((url) => /maplibre/i.test(url))).toBe(false);
  });

  test("MAPLIBRE-10: /login requests no MapLibre script", async ({ page }) => {
    const urls = await requestedUrls(page, "/login");
    expect(urls.some((url) => /maplibre/i.test(url))).toBe(false);
  });

  // Positive control: proves the two negative cases above mean something.
  // Expected to fail today along with them, since maplibre-gl is not
  // installed or loaded anywhere yet (docs/specs/map-maplibre.md,
  // Contracts › Dependency).
  test("MAPLIBRE-10: /map requests at least one MapLibre script", async ({ page }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    const urls = await requestedUrls(page, "/map");
    expect(urls.some((url) => /maplibre/i.test(url))).toBe(true);
  });
});

test.describe("MAPLIBRE-14: OpenFreeMap down — the map still shows its ground, its pins and its preview; nothing errors", () => {
  test("MAPLIBRE-14: with every tile request failing, the ground pixel, the pins, the preview and the results list all still work; no alert role or toast appears", async ({
    page,
  }) => {
    await stubMapTiles(page, { failTiles: true });
    await mockListingSources(page);
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });

    const mapBox = await box(mapEl);
    const pixel = await readPixel(page, mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    expect(pixel).toEqual({ r: 20, g: 20, b: 22 });

    const firstPin = mapEl.locator(".maplibregl-marker").first().getByRole("button");
    await expect(firstPin).toBeVisible({ timeout: ATTR_TIMEOUT });
    await firstPin.click();
    const preview = page.getByRole("article", { name: /vista previa del coche|car preview/i });
    await expect(preview).toBeVisible({ timeout: ATTR_TIMEOUT });

    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    // Next always renders its route announcer with role="alert"; it is not an error alert.
    expect(await page.locator('[role="alert"]:not(#__next-route-announcer__)').count()).toBe(0);
    expect(await page.locator("[data-sonner-toast]").count()).toBe(0);
  });
});

test.describe("MAPLIBRE-15: without WebGL, every map area shows its ground with a status pill instead", () => {
  test("MAPLIBRE-15: desktop /map shows «El mapa no está disponible en este navegador», no pins, no zoom buttons; the results list still works; no pageerror fires", async ({
    page,
  }) => {
    await disableWebGL(page);
    await stubMapTiles(page);
    await mockListingSources(page);
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    await expect(
      mapEl.getByRole("status", { name: "El mapa no está disponible en este navegador" }),
    ).toBeVisible({ timeout: ATTR_TIMEOUT });
    expect(await mapEl.locator(".maplibregl-marker").count()).toBe(0);
    expect(await mapEl.getByRole("button", { name: /^(acercar|zoom in)$/i }).count()).toBe(0);
    expect(await mapEl.getByRole("button", { name: /^(alejar|zoom out)$/i }).count()).toBe(0);

    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  // "the mobile project": see the header comment — this file does not run
  // there, so the phone case runs under chromium with the phone viewport.
  test("MAPLIBRE-15: on a phone, /map shows the same status pill with no pins", async ({
    page,
  }) => {
    await disableWebGL(page);
    await stubMapTiles(page);
    await mockListingSources(page);
    await setLocale(page, "es");
    await page.setViewportSize(PHONE_390);

    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(mapEl).toBeVisible({ timeout: ATTR_TIMEOUT });
    await expect(
      mapEl.getByRole("status", { name: "El mapa no está disponible en este navegador" }),
    ).toBeVisible({ timeout: ATTR_TIMEOUT });
    expect(await mapEl.locator(".maplibregl-marker").count()).toBe(0);
  });

  test("MAPLIBRE-15: in English, the status pill reads «The map isn't available in this browser»", async ({
    page,
  }) => {
    await disableWebGL(page);
    await stubMapTiles(page);
    await mockListingSources(page);
    await setLocale(page, "en");
    await page.setViewportSize(DESKTOP_1440);

    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(
      mapEl.getByRole("status", { name: "The map isn't available in this browser" }),
    ).toBeVisible({ timeout: ATTR_TIMEOUT });
  });

  dbTest(
    "MAPLIBRE-15: without WebGL, an alert's phone zone preview shows the ground alone, with no status pill",
    async ({ page }) => {
      const email = e2eEmail("maplibre15-zone");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [ZONE_ALERT]);
      await disableWebGL(page);
      await stubMapTiles(page);
      await mockListingSources(page);
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);

      await page.goto(`/alerts/${alertId}`);
      await waitForSession(page);

      const zone = page.locator('[data-map="zone"]');
      await expect(zone).toBeVisible({ timeout: ATTR_TIMEOUT });
      expect(await zone.getByRole("status").count()).toBe(0);
    },
  );
});
