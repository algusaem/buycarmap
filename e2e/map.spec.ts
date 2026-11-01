import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";
import { dragDown, sheetOffset } from "./fixtures/drag";
import { swipe } from "./fixtures/touch";
import {
  box,
  expectWithin,
  fadeOutLength,
  framesWatched,
  hitArea,
  scrollableAncestor,
  settledBox,
  watchFrames,
  wholly,
} from "./fixtures/measure";
import { mockListingSources } from "./fixtures/network";

test.beforeEach(async ({ page }) => {
  await mockListingSources(page);
});

test("renders interleaved listings from all sources on the map page", async ({ page }) => {
  await page.goto("/map");

  // One listing from each source proves the three-way fan-out renders.
  // Each listing is a pin named by its title on both widths (MAPUI-25); a
  // phone's results sheet shows only the first card, so card text alone
  // cannot prove the fan-out there.
  // Each pin is a button inside its MapLibre marker (ListingsMap.tsx).
  const pins = page.locator(".maplibregl-marker");
  await expect(pins.getByRole("button", { name: /Audi A3 2\.0 TDI/ })).toBeVisible();
  await expect(pins.getByRole("button", { name: /BMW Serie 3 320d/ })).toBeVisible();
  await expect(pins.getByRole("button", { name: /SEAT León 1\.5 TSI/ })).toBeVisible();
});

test("renders the MapLibre map surface", async ({ page, isMobile }) => {
  // This checks the desktop layout, the map beside the list. A phone keeps the
  // map on screen under the top band and the results sheet, which the
  // MAPUI-20 to MAPUI-24 cases cover.
  test.skip(!!isMobile, "map is behind an overlay on mobile");
  await page.goto("/map");
  await expect(page.locator('[data-map="listings"] canvas.maplibregl-canvas')).toBeVisible();
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

// docs/specs/redesign-map.md (MAPUI-49, MAPUI-50, MAPUI-51). Moved here from
// the former e2e/map-search.spec.ts: this file's name matches the "mobile"
// project's testMatch (playwright.config.ts), so these run under both
// chromium and mobile without a config change. Desktop-only and phone-only
// cases are gated with `isMobile`, the same way "renders the MapLibre map
// surface" above gates itself.

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };
const DESKTOP_1440 = { width: 1440, height: 900 };
const DESKTOP_2560 = { width: 2560, height: 1440 };
const PHONE_390 = { width: 390, height: 844 };

/** Sets the viewport, mocks the three sources, and waits for the fan-out's Audi card (MAPUI-64 to MAPUI-67). */
async function gotoMap(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await mockListingSources(page);
  await page.goto("/map");
  await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
}

// lib/geo/nominatim.ts calls Nominatim from the browser, so page.route()
// answers it; the same place e2e/location-search.spec.ts uses.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search**";
const MADRID_RESULT = {
  place_id: 1,
  display_name: "Madrid, Comunidad de Madrid, España",
  lat: "40.4168",
  lon: "-3.7038",
  address: { city: "Madrid", state: "Comunidad de Madrid" },
};

/** Asserts every visible, named control inside `root` clears the 44px touch floor (MAPUI-51). */
async function assertTouchTargets(root: Locator, label: string) {
  // Waits for the page to have actually rendered root's controls before
  // counting them: without this, .all() can run before React has painted
  // anything, counting zero and failing MAPUI-51 intermittently.
  await expect(root.getByRole("link").or(root.getByRole("button")).first()).toBeVisible();

  const controls = [
    ...(await root.getByRole("link").all()),
    ...(await root.getByRole("button").all()),
  ];

  expect(controls.length, `${label} controls found`).toBeGreaterThan(0);

  for (const control of controls) {
    // A pin is a button inside its MapLibre marker (ListingsMap.tsx): its own
    // box and its ::before hit area are what a finger lands on.
    const target = control;

    if (!(await target.isVisible())) continue;
    const name = (await target.textContent())?.trim() || "(unnamed)";

    const size = await hitArea(target);

    expect(
      size.width >= 44 && size.height >= 44,
      `${label}: ${name} is ${size.width}x${size.height}, under the 44px floor`,
    ).toBe(true);
  }
}

/** Asserts each of `targets` clears the 44px touch floor (MAPUI-51). */
async function assertHitAreas(targets: Locator[], label: string) {
  expect(targets.length, `${label} found`).toBeGreaterThan(0);
  for (const [index, target] of targets.entries()) {
    const size = await hitArea(target);
    expect(
      size.width >= 44 && size.height >= 44,
      `${label} #${index + 1} is ${size.width}x${size.height}, under the 44px floor`,
    ).toBe(true);
  }
}

test.describe("MAPUI-49: desktop search writes to the URL and Back restores it", () => {
  test("MAPUI-49: choosing a place, a brand and a maximum price writes each to the URL; Back restores the previous criteria", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only search flow — the phone flow is MAPUI-50");
    await page.setViewportSize(DESKTOP);
    await mockListingSources(page);
    await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));
    await page.goto("/map");
    // The mock sources' Madrid car: within 50 km of Madrid, and returned
    // whatever the brand and the price asked for.
    const madridCar = page.getByRole("link", { name: /Audi A3 2\.0 TDI/ });

    await page.getByRole("button", { name: /ciudad o código postal|city or postcode/i }).click();
    await page.getByRole("combobox").fill("Madrid");
    await page
      .getByRole("option", { name: /madrid/i })
      .first()
      .click();
    await expect(page).toHaveURL(/locationName=/);
    await expect(madridCar).toBeVisible();

    await page.getByRole("button", { name: /cualquier marca|any make/i }).click();
    await page.getByRole("combobox").fill("Toy");
    await page.getByRole("option", { name: "Toyota" }).click();
    await expect(page).toHaveURL(/make=Toyota/);
    await expect(madridCar).toBeVisible();

    const beforeMaxPrice = page.url();

    // Inside the search pill: the quick filter «Hasta 100.000 km» below it
    // also starts with «Hasta» (MAPUI-63).
    await page
      .getByRole("search")
      .getByRole("button", { name: /^(cualquiera|any)$|^(hasta|desde|up to|from) /i })
      .click();
    // The price shortcuts are a radio group (SearchPopover README › Precio);
    // each radio is visually hidden inside its chip, so the chip is pressed.
    await page
      .getByRole("radiogroup", { name: /precio máximo|maximum price/i })
      .getByText(/^(hasta 20\.000\s€|up to €20,000)$/i)
      .click();
    await expect(page).toHaveURL(/maxPrice=20000/);
    await expect(madridCar).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(beforeMaxPrice);
    // «Precio» reads its any-price value again.
    await expect(page.getByRole("button", { name: /^(cualquiera|any)$/i })).toBeVisible();
  });
});

// docs/specs/redesign-map.md (MAPUI-39). «Crear alerta» only opens for a
// signed-in buyer, so this needs a seeded user (a database run, like
// MAPUI-47 in e2e/alerts.spec.ts, whose `signIn` this duplicates).
const dbTest = process.env.E2E_DB ? test : test.skip;
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe("MAPUI-39: Crear alerta replaces the pin preview", () => {
  dbTest(
    "MAPUI-39: with a pin preview open, Crear alerta leaves its card open and the preview gone",
    async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop-only: a phone pin opens no preview (MAPUI-24)");
      const email = e2eEmail("previewalert");
      await seedUser(email, PASSWORD, "Preview Alert User");
      await mockListingSources(page);
      await page.setViewportSize(DESKTOP);

      await signIn(page, email);
      await page.goto("/map");
      // The pin is the button itself, its price as its text (MapLibre marker).
      await page.getByRole("button", { name: /Audi A3 2\.0 TDI/ }).click();
      const preview = page.getByRole("dialog", { name: "Audi A3 2.0 TDI", exact: true });
      await expect(preview).toBeVisible();

      await page
        .getByRole("button", { name: /^(crear alerta|create alert)$/i })
        .first()
        .click();

      const card = page.getByRole("dialog", { name: /crear alerta|create alert/i });
      await expect(card).toBeVisible();
      await expect(preview).toHaveCount(0);
      // Past the moment a closed preview would hand the focus back to its pin.
      await page.waitForTimeout(300);
      await expect(card).toBeVisible();
    },
  );
});

test.describe("MAPUI-50: phone BUSCAR sheet applies only on Ver coches", () => {
  test("MAPUI-50: choosing in the BUSCAR sheet and pressing Ver coches writes the criteria to the URL", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only BUSCAR sheet flow — the desktop flow is MAPUI-49");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map");

    await page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: /^(buscar|search)$/i })).toBeVisible();

    // The sheet's «Coche» is the field itself, with no «Cualquier marca»
    // button (SearchPopover README › Móvil); «Dónde» is a second combobox.
    const carField = page.getByRole("combobox", { name: /marca o modelo|make or model/i });
    await carField.click();
    await carField.fill("Toy");
    await page.getByRole("option", { name: "Toyota" }).click();

    await page.getByRole("button", { name: /^(ver coches|show cars)$/i }).click();
    await expect(page).toHaveURL(/make=Toyota/);
  });

  test("MAPUI-50: choosing and then closing the sheet leaves the URL as it was", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only BUSCAR sheet flow — the desktop flow is MAPUI-49");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map");
    const before = page.url();
    const summary = page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first();
    const summaryBefore = (await summary.textContent()) ?? "";

    await summary.click();
    const carField = page.getByRole("combobox", { name: /marca o modelo|make or model/i });
    await carField.click();
    await carField.fill("Toy");
    await page.getByRole("option", { name: "Toyota" }).click();
    // The brand step lists Toyota's models once they arrive. While that list
    // shows, the first Escape closes only the list and the second the sheet
    // (MAPUI-21); waiting for it keeps the two presses from racing the fetch.
    await expect(page.getByRole("listbox")).toBeVisible();

    // Choosing the brand lists its models (MAPUI-7) once listCarModels
    // answers, which can be before or after the next key. Wait for the list,
    // so the first Escape always closes the list and the second the sheet
    // (MAPUI-21), instead of racing the request.
    const golf = page.getByRole("option", { name: "Golf" });
    await expect(golf).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(golf).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The summary still reads the search it had, not the discarded choice.
    await expect(summary).toHaveText(summaryBefore);
    await expect(page).toHaveURL(before);
    expect(page.url()).not.toContain("make=Toyota");
  });

  // docs/specs/map-description-search.md (DESC-12): the sheet's own
  // Descripción field applies through «Ver coches», like every other field.
  test("DESC-12: typing e46 in Descripción and pressing Ver coches writes q=e46 and the summary shows «e46»", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only BUSCAR sheet flow");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map");

    await page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: /^(buscar|search)$/i })).toBeVisible();

    const descriptionField = page.getByRole("searchbox", {
      name: /buscar en la descripci[oó]n|search the description/i,
    });
    await descriptionField.fill("e46");
    await page.getByRole("button", { name: /^(ver coches|show cars)$/i }).click();

    await expect(page).toHaveURL(/q=e46/);
    const summary = page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first();
    await expect(summary).toContainText("«e46»");
  });
});

// docs/specs/redesign-saved.md (SAVED-37, SAVED-38): every phone bottom sheet
// closes when its handle is dragged down, and shows no «×».
test.describe("SAVED-37, SAVED-38: the phone BUSCAR sheet closes when dragged down", () => {
  /** Opens the BUSCAR sheet from the summary and waits for it to settle. */
  async function openSearchSheet(page: Page): Promise<{ summary: Locator; sheet: Locator }> {
    await page.setViewportSize(PHONE_390);
    await page.goto("/map");
    const summary = page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first();
    await summary.click();
    const sheet = page.getByRole("dialog", { name: /^(buscar|search)$/i });
    await expect(sheet).toBeVisible();
    await expect
      .poll(() => sheet.evaluate((element) => getComputedStyle(element).opacity))
      .toBe("1");
    return { summary, sheet };
  }

  test("SAVED-37: at 390×844 the BUSCAR sheet shows no «×», and dragging its handle down 150px closes it with focus back on the summary", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only BUSCAR sheet");
    const { summary, sheet } = await openSearchSheet(page);
    // The only close button is «Cerrar», visually hidden: a 1px box inside its
    // 1px border, clipped away.
    const close = await sheet.getByRole("button", { name: /^(cerrar|close)$/i }).boundingBox();
    expect(close?.width).toBeLessThanOrEqual(2);
    expect(close?.height).toBeLessThanOrEqual(2);

    await dragDown(page, sheet.locator("[data-sheet-handle]"), 150);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(summary).toBeFocused();
  });

  test("SAVED-38: at 390×844 a 40px drag of the handle springs the BUSCAR sheet back, and a drag from its body moves nothing", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only BUSCAR sheet");
    const { sheet } = await openSearchSheet(page);

    await dragDown(page, sheet.locator("[data-sheet-handle]"), 40, { hold: true });
    // The last move is drawn on the next frame, which WebKit can paint after
    // the move resolves: polled, not read once.
    await expect.poll(async () => Math.abs((await sheetOffset(sheet)) - 40)).toBeLessThanOrEqual(1);
    await page.mouse.up();
    await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
    await expect(sheet).toBeVisible();

    await dragDown(page, sheet.getByText(/^(dónde|where)$/i).first(), 150, { hold: true });
    expect(await sheetOffset(sheet)).toBe(0);
    await page.mouse.up();
    await expect(sheet).toBeVisible();
  });

  // docs/specs/motion.md (MOTION-20): the release speed is measured from the
  // pointer events, so a flick drawn in one frame on an idle page still
  // reads as fast.
  test("MOTION-20: at 390×844, on an idle page, a fast 60px drag of the handle down, drawn in one frame, closes the BUSCAR sheet", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only BUSCAR sheet");
    const { sheet } = await openSearchSheet(page);
    // Nothing animates for a while, so the last frame drawn is old.
    await page.waitForTimeout(600);

    // Under the 100px that closes by distance: only the speed can close it.
    await dragDown(page, sheet.locator("[data-sheet-handle]"), 60, { fast: true });

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

// No chip remove button («Quitar»/«Remove …») remains anywhere on /map
// (MAPUI-13, MAPUI-63): declared once, above its first use, and reused by
// both the MAPUI-51 and the MAPUI-67 checks below.
const REMOVE_BUTTON_NAME = /^(quitar|remove) /i;

test.describe("MAPUI-51: phone touch targets", () => {
  // docs/specs/redesign-map.md (MAPUI-13, MAPUI-51, MAPUI-63). No chip remove
  // buttons exist; the summary, the «Filters» button and each quick filter
  // take their place in the 44px floor check. `assertTouchTargets` measures
  // every link and button it finds in `main`.
  test("MAPUI-51: the summary, the Filters button, each quick filter, the sheet handle, the pins and the tabs all clear 44x44px", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only touch-target check");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map?engine=gasoil");

    expect(
      await page.getByRole("button", { name: REMOVE_BUTTON_NAME }).count(),
      "no chip remove buttons remain (MAPUI-13, MAPUI-63)",
    ).toBe(0);

    await assertTouchTargets(page.getByRole("main"), "/map phone controls");
    await assertTouchTargets(page.getByRole("navigation"), "tab bar");
  });

  test("MAPUI-51: the price knobs in the BUSCAR sheet, and the knobs and the Cambio options in the phone filters, clear 44x44px", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only touch-target check");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map");

    await page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first()
      .click();
    const searchSheet = page.getByRole("dialog", { name: /^(buscar|search)$/i });
    await expect(searchSheet).toBeVisible();
    await assertHitAreas(await searchSheet.getByRole("slider").all(), "BUSCAR price knob");
    await page.keyboard.press("Escape");
    await expect(searchSheet).toHaveCount(0);

    await page
      .getByRole("button", { name: /^(filtros|filters)/i })
      .first()
      .click();
    const filters = page.getByRole("dialog", { name: /^(filtros|filters)$/i });
    await expect(filters).toBeVisible();
    await assertHitAreas(await filters.getByRole("slider").all(), "filters price knob");
    // Each «Cambio» option is the label around its visually hidden radio.
    const gearbox = filters.getByRole("radiogroup", { name: /^(cambio|transmission)$/i });
    await assertHitAreas(await gearbox.locator("label").all(), "Cambio option");
  });
});

// docs/specs/redesign-map.md (MAPUI-64 to MAPUI-67, design A7 accepted
// 2026-10-17, #134): the header band, the quick filters' desktop row, the
// desktop list/map layout, the list's clipped outline and the phone band.
// These measure the accepted design's exact numbers (worked examples
// "Desktop layout (MAPUI-64, MAPUI-65)" and "The desktop list's clipped
// outline (MAPUI-66)").

const FILTERS_NAME = /^(filtros|filters)$/i;
const MAX_KM_QUICK_NAME = /^(hasta\s*100\.000\s*km|up to\s*100,000\s*km)$/i;
// docs/specs/map-description-search.md (DESC-1, DESC-27): the field at the
// end of row two.
const DESCRIPTION_FIELD_NAME = /^(buscar en la descripci[oó]n|search the description)$/i;
const MAP_REGION_NAME = /^(mapa|map)$/i;
const SUMMARY_NAME = /toda españa|cualquier marca|all of spain|any make/i;

test.describe("MAPUI-64: the desktop header band", () => {
  test("MAPUI-64: the band is 151px tall with no bottom border, and its two rows sit where the design measures them", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only header band");
    await gotoMap(page, DESKTOP_1440);

    const band = page.getByTestId("header-desktop");
    const bandBox = await box(band);
    expectWithin(bandBox.y, 0, "band top");
    expectWithin(bandBox.height, 151, "band height");
    await expect(band).toHaveCSS("background-color", "rgb(24, 24, 27)");
    await expect(band).toHaveCSS("border-bottom-width", "0px");

    // The search pill is the native <search> landmark (SearchPill.tsx).
    const pill = page.getByRole("search");
    const pillBox = await box(pill);
    expectWithin(pillBox.y, 24, "pill top");
    expectWithin(pillBox.y + pillBox.height, 72, "pill bottom");

    // The pill and «Crear alerta» (SearchPill.tsx) are one group, centred on
    // the window: its left margin (the pill's) matches its right margin
    // (Crear alerta's) to within 1px.
    const crearAlerta = band.getByRole("button", { name: /^(crear alerta|create alert)$/i });
    const crearAlertaBox = await box(crearAlerta);
    expectWithin(
      pillBox.x - (DESKTOP_1440.width - (crearAlertaBox.x + crearAlertaBox.width)),
      0,
      "the pill + Crear alerta group centred on the window",
    );

    const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
    const kmQuickFilter = page.getByRole("button", { name: MAX_KM_QUICK_NAME });
    const filtersBox = await box(filtersButton);
    const kmBox = await box(kmQuickFilter);
    expectWithin(filtersBox.y, 100, "row two top");
    expectWithin(filtersBox.y + filtersBox.height, 134, "row two bottom (Filtros)");
    expectWithin(kmBox.y + kmBox.height, 134, "row two bottom (quick filter)");
    // DESC-27: at 1440px and wider, row two starts at the search group's left
    // edge rather than sharing its centre.
    expectWithin(filtersBox.x - pillBox.x, 0, "row two starts at the search group's left edge");

    const wordmarkBox = await box(page.getByRole("link", { name: "BuyCarMap" }));
    expectWithin(wordmarkBox.x, 48, "wordmark left");

    const navBox = await box(
      page.locator("header").getByRole("navigation", { name: /^(main|principal)$/i }),
    );
    expectWithin(navBox.x + navBox.width, 1392, "nav right edge");
  });

  test("MAPUI-64: at 2560×1440 the band is 151px with the pill at 24–72 and row two at 100–134, centred", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only header band");
    await gotoMap(page, DESKTOP_2560);

    const band = page.getByTestId("header-desktop");
    const bandBox = await box(band);
    expectWithin(bandBox.y, 0, "band top");
    expectWithin(bandBox.height, 151, "band height");

    const pill = page.getByRole("search");
    const pillBox = await box(pill);
    expectWithin(pillBox.y, 24, "pill top");
    expectWithin(pillBox.y + pillBox.height, 72, "pill bottom");

    const crearAlerta = band.getByRole("button", { name: /^(crear alerta|create alert)$/i });
    const crearAlertaBox = await box(crearAlerta);
    expectWithin(
      pillBox.x - (DESKTOP_2560.width - (crearAlertaBox.x + crearAlertaBox.width)),
      0,
      "the pill + Crear alerta group centred on the window",
    );

    const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
    const kmQuickFilter = page.getByRole("button", { name: MAX_KM_QUICK_NAME });
    const filtersBox = await box(filtersButton);
    const kmBox = await box(kmQuickFilter);
    expectWithin(filtersBox.y, 100, "row two top");
    expectWithin(filtersBox.y + filtersBox.height, 134, "row two bottom (Filtros)");
    expectWithin(kmBox.y + kmBox.height, 134, "row two bottom (quick filter)");
    // DESC-27: at 1440px and wider, row two starts at the search group's left
    // edge rather than sharing its centre.
    expectWithin(filtersBox.x - pillBox.x, 0, "row two starts at the search group's left edge");
  });

  dbTest(
    "MAPUI-64 (dbTest): signed in at 1440×900 the band holds the section links with Map current, and row two shares the search group's axis",
    async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop-only header band");
      const email = e2eEmail("headerbanddesktop");
      await seedUser(email, PASSWORD, "Header Band User");
      await mockListingSources(page);
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email);
      await page.goto("/map");
      await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

      const band = page.getByTestId("header-desktop");
      const bandBox = await box(band);
      expectWithin(bandBox.height, 151, "band height");

      const mapLink = band.getByRole("link", { name: /^(mapa|map)$/i });
      await expect(mapLink).toHaveAttribute("aria-current", "page");
      await expect(band.getByRole("link", { name: /^(guardados|saved)$/i })).toBeVisible();
      await expect(band.getByRole("link", { name: /^(alertas|alerts)$/i })).toBeVisible();

      const pill = page.getByRole("search");
      const pillBox = await box(pill);
      expectWithin(pillBox.y, 24, "pill top");
      expectWithin(pillBox.y + pillBox.height, 72, "pill bottom");

      await expect(
        band.getByRole("button", { name: /^(crear alerta|create alert)$/i }),
      ).toBeVisible();

      const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
      const filtersBox = await box(filtersButton);
      expectWithin(filtersBox.y, 100, "row two top");
      expectWithin(filtersBox.y + filtersBox.height, 134, "row two bottom (Filtros)");

      // DESC-27: at 1440px and wider, row two starts at the search group's
      // left edge rather than sharing its centre.
      expectWithin(filtersBox.x - pillBox.x, 0, "row two starts at the search group's left edge");

      const navBox = await box(
        page.locator("header").getByRole("navigation", { name: /^(main|principal)$/i }),
      );
      expectWithin(navBox.x + navBox.width, 1392, "nav right edge");
    },
  );
});

// docs/specs/redesign-map.md (MAPUI-70, design accepted 2026-10-22, #157):
// from 1024 to 1439px wide the band is the same surface band but in three
// rows instead of MAPUI-64's two. Numbers from the worked example "Desktop
// layout (MAPUI-64, MAPUI-65)", row 1024 × 900.
test.describe("MAPUI-70: the laptop header band", () => {
  for (const width of [1024, 1439]) {
    test(`MAPUI-70: at ${width}×900 the band is 219px in three rows: the wordmark and navigation, then the search group, then the filters, centred`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "desktop-only header band");
      await gotoMap(page, { width, height: 900 });

      const band = page.getByTestId("header-desktop");
      const bandBox = await box(band);
      expectWithin(bandBox.y, 0, "band top");
      expectWithin(bandBox.height, 219, "band height");

      const wordmark = page.getByRole("link", { name: "BuyCarMap" });
      const wordmarkBox = await box(wordmark);
      expectWithin(wordmarkBox.x, 48, "wordmark left");
      expectWithin(wordmarkBox.y + wordmarkBox.height / 2, 48, "wordmark vertical centre");

      const nav = page.locator("header").getByRole("navigation", { name: /^(main|principal)$/i });
      const navBox = await box(nav);
      expectWithin(navBox.x + navBox.width, width - 48, "navigation right edge");
      expectWithin(navBox.y + navBox.height / 2, 48, "navigation vertical centre");

      const pill = page.getByRole("search");
      const pillBox = await box(pill);
      expectWithin(pillBox.y, 92, "pill top");
      expectWithin(pillBox.y + pillBox.height, 140, "pill bottom");

      const crearAlerta = band.getByRole("button", { name: /^(crear alerta|create alert)$/i });
      const crearAlertaBox = await box(crearAlerta);
      expectWithin(
        pillBox.x - (width - (crearAlertaBox.x + crearAlertaBox.width)),
        0,
        "the pill + Crear alerta group centred on the window",
      );

      const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
      const kmQuickFilter = page.getByRole("button", { name: MAX_KM_QUICK_NAME });
      const filtersBox = await box(filtersButton);
      const kmBox = await box(kmQuickFilter);
      expectWithin(filtersBox.y, 168, "row two top");
      expectWithin(filtersBox.y + filtersBox.height, 202, "row two bottom (Filtros)");
      expectWithin(kmBox.y + kmBox.height, 202, "row two bottom (quick filter)");

      // DESC-27: below 1440px the measure runs from «Filtros» to the
      // description field (row two's new rightmost element), still centred
      // on the window.
      const descriptionField = page.getByRole("searchbox", { name: DESCRIPTION_FIELD_NAME });
      // The input sits inside the pill's border, so the row's edge is the pill's.
      const descriptionBox = await box(descriptionField.locator(".."));
      expectWithin(
        filtersBox.x - (width - (descriptionBox.x + descriptionBox.width)),
        0,
        "row two centred on the window",
      );

      const offenders = await band.evaluate(
        (el, bounds: { left: number; right: number }) =>
          [...el.querySelectorAll("*")]
            .map((node) => ({
              tag: node.tagName.toLowerCase(),
              rect: node.getBoundingClientRect(),
            }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0)
            .filter(({ rect }) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
            .map(
              ({ tag, rect }) =>
                `${tag} left=${rect.left.toFixed(1)} right=${rect.right.toFixed(1)}`,
            ),
        { left: 48, right: width - 48 },
      );
      expect(offenders, `elements past the 48px side margins: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});

// docs/specs/map-description-search.md (DESC-27): the field does not move
// the search group at 1440px and wider.
test.describe("DESC-27: the description field and the search group", () => {
  // The deep link that gives «Filtros» its longest badge (every fuel group,
  // a gearbox, a mileage ceiling, a minimum year and «Publicado»), plus the
  // field's own applied text at its 100-character limit — the two widest
  // things row two ever draws at once.
  const WIDEST_ROW_TWO =
    "engine=gasoline,gasoil,hybride,hybride_plugin,electric,cng&gearbox=manual&maxKm=100000" +
    "&minYear=2015&timeFilter=today&make=Volkswagen&model=Golf&maxPrice=20000" +
    `&q=${"a".repeat(100)}`;

  for (const width of [1024, 1440, 2560]) {
    test(`DESC-27: at ${width}px with the badge at its longest, the page has no horizontal overflow`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "desktop-only header band");
      await page.setViewportSize({ width, height: 900 });
      await mockListingSources(page);
      await page.goto(`/map?${WIDEST_ROW_TWO}`);
      await expect(page.getByRole("button", { name: FILTERS_NAME }).first()).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `documentElement.scrollWidth at ${width}px`).toBeLessThanOrEqual(width);

      const band = page.getByTestId("header-desktop");
      const bandBox = await box(band);
      // 1024px is still the laptop band (MAPUI-70), whose 48px side margins
      // are load-bearing (not just the band's own edges, as at 1440px and
      // wider, where the band itself may legitimately reach the window).
      const bounds = width === 1024 ? { left: 48, right: width - 48 } : { left: 0, right: width };
      const offenders = await band.evaluate(
        (el, bounds: { left: number; right: number }) =>
          [...el.querySelectorAll("*")]
            .map((node) => ({
              tag: node.tagName.toLowerCase(),
              rect: node.getBoundingClientRect(),
            }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0)
            .filter(({ rect }) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
            .map(
              ({ tag, rect }) =>
                `${tag} left=${rect.left.toFixed(1)} right=${rect.right.toFixed(1)}`,
            ),
        bounds,
      );
      expect(offenders, `elements past the band's own bounds: ${offenders.join(", ")}`).toEqual([]);
      expect(bandBox.width).toBeLessThanOrEqual(width);
    });
  }

  dbTest(
    "DESC-27 (dbTest): signed in at 1440×900 with the design's values, row two does not widen the search group's column",
    async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop-only header band");
      const email = e2eEmail("descsearchgroupcentre");
      await seedUser(email, PASSWORD, "Desc Search Group User");
      await mockListingSources(page);
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email);
      await page.goto("/map?lat=40.4168&lng=-3.7038&locationName=Madrid&radius=50&maxPrice=20000");
      await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

      const crearAlerta = page.getByRole("button", { name: /^(crear alerta|create alert)$/i });
      const crearAlertaBox = await box(crearAlerta);
      const nav = page.locator("header").getByRole("navigation", { name: /^(main|principal)$/i });
      const navBox = await box(nav);
      const descriptionField = page.getByRole("searchbox", { name: DESCRIPTION_FIELD_NAME });
      // The input sits inside the pill's border, so the row's edge is the pill's.
      const descriptionBox = await box(descriptionField.locator(".."));

      expectWithin(
        crearAlertaBox.x + crearAlertaBox.width,
        navBox.x,
        "the group ends where the nav starts",
      );
      expect(crearAlertaBox.x + crearAlertaBox.width).toBeLessThan(
        descriptionBox.x + descriptionBox.width,
      );
    },
  );
});

test.describe("MAPUI-65: the desktop list and map share the width", () => {
  test("MAPUI-65: at 1440x900 the heading, the map card and the first two rows of cards sit where the design measures them", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, { width: 1440, height: 900 });

    const headingBox = await box(page.locator("h1"));
    expectWithin(headingBox.y, 175, "heading top");

    const mapBox = await box(page.getByRole("region", { name: MAP_REGION_NAME }));
    expectWithin(mapBox.x, 744, "map left");
    expectWithin(mapBox.x + mapBox.width, 1392, "map right");
    expectWithin(mapBox.y, headingBox.y, "map top level with the heading's top");
    expectWithin(mapBox.y + mapBox.height, 876, "map bottom");
    const map = page.getByRole("region", { name: MAP_REGION_NAME });
    await expect(map).toHaveCSS("border-radius", "22px");
    await expect(map).toHaveCSS("border-left-width", "0px");

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = await box(cards.nth(0));
    const secondCard = await box(cards.nth(1));
    const thirdCard = await box(cards.nth(2));
    expectWithin(firstCard.x, 48, "first card left");
    expectWithin(secondCard.x - (firstCard.x + firstCard.width), 24, "gap between columns");
    expectWithin(secondCard.x + secondCard.width, 696, "second card right edge");
    expectWithin(firstCard.y, secondCard.y, "the first row's two cards share a top");
    expectWithin(
      thirdCard.y - (firstCard.y + firstCard.height),
      40,
      "gap between the first and second row",
    );
  });

  test("MAPUI-65: at 1920x1080 three cards share the first row's top", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, { width: 1920, height: 1080 });

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = await box(cards.nth(0));
    const secondCard = await box(cards.nth(1));
    const thirdCard = await box(cards.nth(2));
    expectWithin(firstCard.y, secondCard.y, "card 2 shares the first row's top");
    expectWithin(firstCard.y, thirdCard.y, "card 3 shares the first row's top");
  });

  test("MAPUI-65: at 1919×1080 the grid keeps two columns", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, { width: 1919, height: 1080 });

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = await box(cards.nth(0));
    const thirdCard = await box(cards.nth(2));
    expect(
      thirdCard.y,
      `third card top (${thirdCard.y}) at or below the first card's bottom (${firstCard.y + firstCard.height}), two columns not three`,
    ).toBeGreaterThanOrEqual(firstCard.y + firstCard.height);
  });

  test("MAPUI-65: at 2560x1440 the map card and the heading sit where the design measures them", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, { width: 2560, height: 1440 });

    const headingBox = await box(page.locator("h1"));
    expectWithin(headingBox.y, 175, "heading top");

    const mapBox = await box(page.getByRole("region", { name: MAP_REGION_NAME }));
    expectWithin(mapBox.x, 1304, "map left");
    expectWithin(mapBox.x + mapBox.width, 2512, "map right");
    expectWithin(mapBox.y + mapBox.height, 1416, "map bottom");

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = await box(cards.nth(0));
    const secondCard = await box(cards.nth(1));
    const thirdCard = await box(cards.nth(2));
    expectWithin(firstCard.x, 48, "first card left");
    expectWithin(thirdCard.x + thirdCard.width, 1256, "third card right");
    expectWithin(firstCard.y, secondCard.y, "card 2 shares the first row's top");
    expectWithin(firstCard.y, thirdCard.y, "card 3 shares the first row's top");
  });
});

test.describe("MAPUI-66: the desktop list's outline is never clipped (bug fix, #134)", () => {
  test("MAPUI-66: the list's scroll container sits clear of the cards on every side, with the scrollbar away from them", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, { width: 1440, height: 900 });

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = await box(cards.nth(0));
    const secondCard = await box(cards.nth(1));
    const rightmostFirstRow = Math.max(
      firstCard.x + firstCard.width,
      secondCard.x + secondCard.width,
    );

    // The list's scroll container: the nearest ancestor of the first card set
    // to scroll vertically. Chosen by its style, not by whether it overflows,
    // since three stubbed cars may not fill it; with none, the test fails.
    const scroller = await cards.nth(0).evaluate((element) => {
      let node: HTMLElement | null = element.parentElement;
      while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
        node = node.parentElement;
      }
      if (!node) throw new Error("the first card has no scrolling ancestor");
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    const mapBox = await box(page.getByRole("region", { name: MAP_REGION_NAME }));

    expect(
      scroller.x,
      `scroll container left (${scroller.x}) clear of the first card's left (${firstCard.x})`,
    ).toBeLessThanOrEqual(firstCard.x - 2);
    expect(
      scroller.y,
      `scroll container top (${scroller.y}) clear of the first card's top (${firstCard.y})`,
    ).toBeLessThanOrEqual(firstCard.y - 2);
    expect(
      scroller.x + scroller.width,
      `scroll container right (${scroller.x + scroller.width}) clear of the first row (${rightmostFirstRow})`,
    ).toBeGreaterThanOrEqual(rightmostFirstRow + 2);
    expect(
      scroller.x + scroller.width - rightmostFirstRow,
      "the scrollbar sits clear of the cards (at least 16px of padding)",
    ).toBeGreaterThanOrEqual(16);
    expect(
      scroller.x + scroller.width,
      "the scroll container's right edge never reaches into the map",
    ).toBeLessThanOrEqual(mapBox.x);
  });

  test("MAPUI-66: at 1440×900, focusing the first card's link with the keyboard draws the photo's lime ring and no outline around the card", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-desktop",
      "Safari's Tab skips links by default (A11Y-16)",
    );
    test.skip(isMobile, "desktop-only layout");
    await gotoMap(page, DESKTOP_1440);

    const cards = page.getByTestId("results-sheet").locator("article");
    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);
    const firstLink = firstCard.getByRole("link").first();
    const firstPhoto = firstCard.locator("a > div").first();

    // Tabs from the top of the page until the first card's link takes focus,
    // rather than hard-coding how many stops precede it.
    for (let tabs = 0; tabs < 60; tabs++) {
      await page.keyboard.press("Tab");
      if (await firstLink.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(firstLink).toBeFocused();

    // The ring's own box-shadow transition (CarCard.tsx's
    // transition-[box-shadow]) can still be mid-flight right after focus
    // lands, so this polls rather than reading the computed style once.
    await expect
      .poll(() => firstPhoto.evaluate((element) => getComputedStyle(element).boxShadow))
      .toContain("rgb(198, 255, 61)");
    // `outline-hidden` (RULES.md §19, #134) keeps a transparent outline for
    // forced-colors mode rather than `outline-style: none`, so this accepts
    // either: no outline drawn is `outlineStyle === "none"` or a fully
    // transparent `outlineColor`.
    const outline = await firstLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, color: style.outlineColor };
    });
    expect(
      outline.style === "none" || outline.color === "rgba(0, 0, 0, 0)",
      "no outline draws around the card's link",
    ).toBe(true);

    // Hovering a different card must not touch the keyboard-focused card's
    // ring: `active` (hover) and `group-focus-visible/card` (focus) are
    // independent (MAPUI-66).
    const secondBox = await box(secondCard);
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);

    await expect
      .poll(() => firstPhoto.evaluate((element) => getComputedStyle(element).boxShadow))
      .toContain("rgb(198, 255, 61)");
    const outlineAfterHover = await firstLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, color: style.outlineColor };
    });
    expect(
      outlineAfterHover.style === "none" || outlineAfterHover.color === "rgba(0, 0, 0, 0)",
      "still no outline after hovering the second card",
    ).toBe(true);
  });
});

// docs/specs/redesign-map.md (MAPUI-63): the quick filters apply at once,
// writing to the URL and pressing themselves, at every width.
test.describe("MAPUI-63: the quick filters write to the URL", () => {
  test("MAPUI-63: at 1440×900, pressing «Diésel» in the header band writes engine=gasoil to the URL, presses it and shows the «Filtros» badge 1; pressing it again removes engine and releases it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only header band");
    await gotoMap(page, { width: 1440, height: 900 });

    const band = page.getByTestId("header-desktop");
    const diesel = band.getByRole("button", { name: /^(diésel|diesel)$/i });
    await expect(diesel).toHaveAttribute("aria-pressed", "false");

    await diesel.click();
    await expect(page).toHaveURL(/engine=gasoil/);
    await expect(diesel).toHaveAttribute("aria-pressed", "true");
    // Locates the visible badge itself, not the button's full text: the
    // sr-only aria-describedby span (MAPUI-64) carries its own "1" too.
    const filtersButton = band.getByRole("button", { name: FILTERS_NAME });
    await expect(filtersButton.getByText("1", { exact: true })).toBeVisible();

    await diesel.click();
    await expect(page).not.toHaveURL(/engine=gasoil/);
    await expect(diesel).toHaveAttribute("aria-pressed", "false");
  });

  test("MAPUI-63: on a 390×844 phone at /map?maxKm=150000, «Hasta 100.000 km» starts released; pressing it writes maxKm=100000 and presses it; pressing again removes maxKm", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only quick filter");
    await page.setViewportSize({ width: 390, height: 844 });
    await mockListingSources(page);
    await page.goto("/map?maxKm=150000");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    const band = page.getByTestId("phone-map-band");
    const maxKmChip = band.getByRole("button", { name: MAX_KM_QUICK_NAME });
    await expect(maxKmChip).toHaveAttribute("aria-pressed", "false");

    await maxKmChip.click();
    await expect(page).toHaveURL(/maxKm=100000/);
    await expect(maxKmChip).toHaveAttribute("aria-pressed", "true");

    await maxKmChip.click();
    await expect(page).not.toHaveURL(/maxKm=/);
    await expect(maxKmChip).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("MAPUI-67: the phone map band", () => {
  test("MAPUI-67: the band holds the summary, Filters and the quick filters, draws no bottom border, and the map starts under it", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only band");
    await gotoMap(page, PHONE_390);

    // The band (MapResultsArea.tsx's "phone-map-band" div) MAPUI-67 asks for:
    // a solid `surface` band with no border, holding the summary, «Filters»
    // and the quick filters, with the map starting under it rather than
    // behind it.
    const band = page.getByTestId("phone-map-band");
    const bandBox = await box(band);

    await expect(band.getByRole("button", { name: SUMMARY_NAME }).first()).toBeVisible();
    await expect(band.getByRole("button", { name: FILTERS_NAME }).first()).toBeVisible();
    await expect(band.getByRole("group")).toBeVisible();
    await expect(band).toHaveCSS("border-bottom-width", "0px");

    const mapBox = await box(page.getByRole("region", { name: MAP_REGION_NAME }));
    expect(
      mapBox.y,
      `the map's top (${mapBox.y}) is at or below the band's bottom (${bandBox.y + bandBox.height})`,
    ).toBeGreaterThanOrEqual(bandBox.y + bandBox.height - 0.5);

    expect(
      await page.getByRole("button", { name: REMOVE_BUTTON_NAME }).count(),
      "no chip remove buttons remain (MAPUI-13, MAPUI-63)",
    ).toBe(0);
  });

  test("MAPUI-67: on a 390×844 phone, the results sheet at its full position starts at or below the band's bottom", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only band");
    await gotoMap(page, PHONE_390);

    const band = page.getByTestId("phone-map-band");
    const bandBox = await box(band);

    const handle = page.getByRole("button", { name: /^(lista de resultados|results list)$/i });
    await handle.click();
    const sheet = page.getByTestId("results-sheet");
    await expect(sheet).toHaveAttribute("data-position", "full");
    const sheetBox = await settledBox(sheet);

    expect(
      sheetBox.y,
      `the full sheet's top (${sheetBox.y}) is at or below the band's bottom (${bandBox.y + bandBox.height})`,
    ).toBeGreaterThanOrEqual(bandBox.y + bandBox.height - 0.5);
  });

  test("MAPUI-67: at 320×568 the quick filters scroll sideways inside the band and the page does not", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only band");
    await gotoMap(page, { width: 320, height: 568 });

    const quickFilters = page.getByTestId("phone-map-band").getByRole("group");
    const [groupScrollWidth, groupClientWidth] = await quickFilters.evaluate((element) => [
      element.scrollWidth,
      element.clientWidth,
    ]);
    expect(
      groupScrollWidth,
      `quick filters scrollWidth (${groupScrollWidth}) greater than clientWidth (${groupClientWidth})`,
    ).toBeGreaterThan(groupClientWidth);

    const pageScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageScrollWidth, "the page itself does not scroll sideways").toBe(320);
  });

  test("MAPUI-67: at 375×667 the results sheet in its middle position starts at or below the band's bottom", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only band");
    await gotoMap(page, { width: 375, height: 667 });

    const band = page.getByTestId("phone-map-band");
    const bandBox = await box(band);

    const sheet = page.getByTestId("results-sheet");
    await expect(sheet).toHaveAttribute("data-position", "middle");
    const sheetBox = await settledBox(sheet);

    expect(
      sheetBox.y,
      `the middle sheet's top (${sheetBox.y}) is at or below the band's bottom (${bandBox.y + bandBox.height})`,
    ).toBeGreaterThanOrEqual(bandBox.y + bandBox.height - 0.5);
  });
});

// docs/specs/redesign-map.md (MAPUI-59, MAPUI-60, MAPUI-62, #133), worked
// example "Phone results sheet (MAPUI-58 to MAPUI-62, #133)". Positions are
// measured, never hardcoded: the board gives no fixed sheet heights. Each is
// the sheet's offset (how far down it is translated) at rest there: F at full,
// M at middle, P at peeked.
const SHEET_HANDLE = /^(lista de resultados|results list)$/i;

interface SheetOffsets {
  full: number;
  middle: number;
  peeked: number;
}

/** Drawn frames the sheet must hold still for to count as settled (MAPUI-59, worked example «Release point»). */
const SETTLED_FRAMES = 5;
/** How long the sheet may take to settle before the test fails, in ms. */
const SETTLE_TIMEOUT_MS = 5000;

/**
 * The sheet's offset once it stops moving, with `data-position` at `position`:
 * watched on consecutive drawn frames (requestAnimationFrame) inside the page,
 * it counts as settled once it has moved less than 0.5px for SETTLED_FRAMES
 * frames in a row, never after a stretch of wall-clock time, which a browser
 * skipping frames can fill without drawing the sheet's last moves.
 */
async function settledOffset(sheet: Locator, position: keyof SheetOffsets): Promise<number> {
  await expect(sheet).toHaveAttribute("data-position", position);
  return sheet.evaluate(
    (element, { frames, timeoutMs }) =>
      new Promise<number>((resolve, reject) => {
        const offset = () => new DOMMatrix(getComputedStyle(element).transform).m42;
        const startedAt = performance.now();
        let previous = offset();
        let still = 0;
        function check() {
          const current = offset();
          still = Math.abs(current - previous) < 0.5 ? still + 1 : 0;
          previous = current;
          if (still >= frames) {
            resolve(current);
            return;
          }
          if (performance.now() - startedAt > timeoutMs) {
            reject(
              new Error(`the sheet did not hold still for ${frames} frames in ${timeoutMs}ms`),
            );
            return;
          }
          requestAnimationFrame(check);
        }
        requestAnimationFrame(check);
      }),
    { frames: SETTLED_FRAMES, timeoutMs: SETTLE_TIMEOUT_MS },
  );
}

// `data-position` is "middle" from the server render on, and until the page
// hydrates and measures the positions the sheet rests at middle with its
// resting layout, not yet translated, while /map's loading frame draws a
// second results sheet beside it (app/map/loading.tsx). The sheet is placed
// once that frame is gone and it is translated down to middle.
async function expectSheetPlacedAtMiddle(page: Page, sheet: Locator): Promise<number> {
  await expect(page.getByTestId("map-loading-desktop")).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheetOffset(sheet)).toBeGreaterThan(0);
  return settledOffset(sheet, "middle");
}

/**
 * Opens /map at 390×844 with the map drawn and the results in (the header,
 * whose height the offsets depend on, no longer says it is searching), and
 * the sheet placed and settled at middle.
 */
async function openPhoneMap(page: Page) {
  await page.setViewportSize(PHONE_390);
  await mockListingSources(page);
  await page.goto("/map");
  const sheet = page.getByTestId("results-sheet");
  const handle = sheet.getByRole("button", { name: SHEET_HANDLE });
  const strip = page.getByTestId("results-sheet-handle-strip");
  await expect(page.locator('[data-map="listings"] canvas.maplibregl-canvas')).toBeVisible();
  await expect(sheet.getByRole("article").first()).toBeVisible();
  const middle = await expectSheetPlacedAtMiddle(page, sheet);
  return { sheet, handle, strip, middle };
}

test.describe("MAPUI-59: dragging the results sheet between positions", () => {
  /**
   * F, M and P, measured by pressing the handle round the three positions
   * (middle → full → peeked → middle, MAPUI-58); it ends back at middle.
   */
  async function measureOffsets(
    sheet: Locator,
    handle: Locator,
    middle: number,
  ): Promise<SheetOffsets> {
    await handle.click();
    const full = await settledOffset(sheet, "full");
    await handle.click();
    const peeked = await settledOffset(sheet, "peeked");
    await handle.click();
    await settledOffset(sheet, "middle");
    expect(full, "full is above middle").toBeLessThan(middle);
    expect(peeked, "peeked is below middle").toBeGreaterThan(middle);
    return { full, middle, peeked };
  }

  test("MAPUI-59: dragging the header up from middle by 0.6·(M−F), released slowly, ends at full, and Enter on the handle then goes to peeked", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);

    await dragDown(
      page,
      sheet.getByRole("heading", { level: 1 }),
      -Math.round(0.6 * (offsets.middle - offsets.full)),
    );

    await settledOffset(sheet, "full");
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    // The tab bar hides only while the sheet is full (MAPUI-53).
    await expect(page.getByTestId("bottom-nav")).toHaveAttribute("aria-hidden", "true");

    await handle.focus();
    await page.keyboard.press("Enter");
    await settledOffset(sheet, "peeked");
  });

  test("MAPUI-59: dragging the handle down from middle by 0.3·(P−M), released slowly, settles back at middle", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);

    await dragDown(page, strip, Math.round(0.3 * (offsets.peeked - offsets.middle)));

    expectWithin(await settledOffset(sheet, "middle"), offsets.middle, "offset back at middle");
  });

  test("MAPUI-59: dragging the handle down from full past the M/P midpoint, released slowly, ends at peeked", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);
    await handle.click();
    await settledOffset(sheet, "full");

    // 20px past the midpoint between M and P, still above P.
    const pastMidpoint = Math.round((offsets.middle + offsets.peeked) / 2 - offsets.full) + 20;
    expect(pastMidpoint).toBeLessThan(offsets.peeked - offsets.full);
    await dragDown(page, strip, pastMidpoint);

    await settledOffset(sheet, "peeked");
  });

  test("MAPUI-60: a fast 60px drag of the handle down from middle, shorter than half of P−M, ends at peeked", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);

    // Released slowly this would settle back at middle: only the speed moves it.
    expect(60).toBeLessThan((offsets.peeked - offsets.middle) / 2);
    await dragDown(page, strip, 60, { fast: true });

    await settledOffset(sheet, "peeked");
  });

  test("MAPUI-60: a fast 60px drag of the header up from middle, shorter than half of M−F, ends at full", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);

    // Released slowly this would settle back at middle: only the speed moves it.
    expect(60).toBeLessThan((offsets.middle - offsets.full) / 2);
    await dragDown(page, sheet.getByRole("heading", { level: 1 }), -60, { fast: true });

    await settledOffset(sheet, "full");
  });

  test("MAPUI-60: a fast 60px drag of the handle up from middle, shorter than half of M−F, ends at full", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);
    // Nothing animates for a while, so the last frame drawn is old (MOTION-20).
    await page.waitForTimeout(600);

    // Released slowly this would settle back at middle: only the speed moves it.
    expect(60).toBeLessThan((offsets.middle - offsets.full) / 2);
    await dragDown(page, strip, -60, { fast: true });

    await settledOffset(sheet, "full");
  });

  test("MAPUI-60: a fast 60px drag of the handle down from full, shorter than half of M−F, ends at middle", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);
    await handle.click();
    await settledOffset(sheet, "full");

    // Released slowly this would settle back at full: only the speed moves it.
    expect(60).toBeLessThan((offsets.middle - offsets.full) / 2);
    await dragDown(page, strip, 60, { fast: true });

    await settledOffset(sheet, "middle");
  });

  test("MAPUI-60: a fast drag of the handle down from peeked leaves the sheet at peeked, its offset still P", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "Playwright's mobile WebKit can deliver the last move and the release in one frame, so Motion never starts the gesture (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, strip, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);
    await handle.click();
    await settledOffset(sheet, "full");
    await handle.click();
    await settledOffset(sheet, "peeked");

    await dragDown(page, strip, 60, { fast: true });

    expectWithin(await settledOffset(sheet, "peeked"), offsets.peeked, "offset still at peeked");
  });

  test("MAPUI-60: under reduced motion a handle press at middle reaches full at once; without it, the spring is still on its way two frames later", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    // Every frame from the click on is read inside the page (watchFrames): a
    // read two frames later from here raced the spring on a loaded runner.
    // The second frame after the click is the one that counts, as before:
    // the first is what a jump needs to be drawn.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await openPhoneMap(page);
    const reducedWatch = await watchFrames(reduced.sheet, { startOn: "click" });
    await reduced.handle.click();
    await expect(reduced.sheet).toHaveAttribute("data-position", "full");
    const reducedFrames = (await framesWatched(reducedWatch)).frames;
    expect(reducedFrames.length, "two frames drawn after the click").toBeGreaterThan(1);
    // At once: from the second frame on, the sheet is in its place.
    expect(Math.max(...reducedFrames.slice(1).map((frame) => frame.offsetY))).toBeLessThan(0.5);

    // The control: with motion allowed the same press springs.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const animated = await openPhoneMap(page);
    const animatedWatch = await watchFrames(animated.sheet, { startOn: "click" });
    await animated.handle.click();
    await expect(animated.sheet).toHaveAttribute("data-position", "full");
    const animatedFrames = (await framesWatched(animatedWatch)).frames;
    expect(
      animatedFrames[1]?.offsetY,
      "still on its way two frames after the click",
    ).toBeGreaterThan(0.5);
  });

  test("MAPUI-59: at full, a drag that starts in the list does not move the sheet, not even mid-drag", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle } = await openPhoneMap(page);
    await handle.click();
    const full = await settledOffset(sheet, "full");

    const card = sheet.getByRole("article").first();
    await dragDown(page, card, 200, { hold: true });
    expectWithin(await sheetOffset(sheet), full, "offset still at full mid-drag");
    await page.mouse.up();

    await expect(sheet).toHaveAttribute("data-position", "full");
  });

  test("MAPUI-59: dragging the card up from middle, released slowly, ends at full", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet } = await openPhoneMap(page);

    await dragDown(page, sheet.getByRole("article").first(), -300);

    await settledOffset(sheet, "full");
  });

  test.describe("MAPUI-71: with a real finger", () => {
    test.skip(
      ({ browserName, isMobile }) => browserName !== "chromium" || !isMobile,
      "touch through Input.dispatchTouchEvent, which only a phone Chromium project has",
    );

    test("MAPUI-71: a swipe up on the middle sheet's card reaches full", async ({ page }) => {
      const { sheet } = await openPhoneMap(page);

      await swipe(page, sheet.getByRole("article").first(), -250);

      await settledOffset(sheet, "full");
    });

    test("MAPUI-71: a swipe down on the middle sheet's card reaches peeked", async ({ page }) => {
      const { sheet } = await openPhoneMap(page);

      await swipe(page, sheet.getByRole("article").first(), 250);

      await settledOffset(sheet, "peeked");
    });

    test("MAPUI-71: at full, a swipe up in the list scrolls the list and leaves the sheet at full", async ({
      page,
    }) => {
      const { sheet, handle } = await openPhoneMap(page);
      await handle.click();
      await settledOffset(sheet, "full");

      const card = sheet.getByRole("article").first();
      const list = await scrollableAncestor(card);
      await swipe(page, card, -300);

      await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await list.dispose();
      await expect(sheet).toHaveAttribute("data-position", "full");
    });
  });

  test("MAPUI-59: at full, scrolling inside the list scrolls the list and leaves the sheet at full", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      test.info().project.name === "webkit-iphone",
      "MAPUI-59 scrolls with the mouse wheel, which Playwright's mobile WebKit does not provide (A11Y-16)",
    );
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle } = await openPhoneMap(page);
    await handle.click();
    const full = await settledOffset(sheet, "full");

    const card = sheet.getByRole("article").first();
    const list = await scrollableAncestor(card);
    const cardBox = await box(card);
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.wheel(0, 300);

    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await list.dispose();
    await expect(sheet).toHaveAttribute("data-position", "full");
    expectWithin(await sheetOffset(sheet), full, "offset still at full");
  });

  test("MAPUI-59: at desktop width, dragging the docked list's heading moves nothing", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only: the list column does not drag");
    await page.setViewportSize(DESKTOP);
    await mockListingSources(page);
    await page.goto("/map");
    const sheet = page.getByTestId("results-sheet");
    await expect(sheet.getByRole("article").first()).toBeVisible();
    await expect(page.getByTestId("map-loading-desktop")).toHaveCount(0);
    const before = await box(sheet);

    await dragDown(page, sheet.getByRole("heading", { level: 1 }), -200);

    const after = await box(sheet);
    expectWithin(after.x, before.x, "list column x");
    expectWithin(after.y, before.y, "list column y");
    expectWithin(after.width, before.width, "list column width");
    expectWithin(after.height, before.height, "list column height");
  });
});

test.describe("MAPUI-62: the map lowers the middle results sheet", () => {
  /**
   * A point on the bare map between the top band's lower edge and the
   * middle sheet's top edge: inside the MapLibre map and on no pin.
   */
  async function bareMapPoint(page: Page, sheet: Locator): Promise<{ x: number; y: number }> {
    const search = await box(page.getByTestId("phone-map-band"));
    const top = (await box(sheet)).y;
    const searchBottom = search.y + search.height;
    expect(top - searchBottom, "room between the band and the sheet").toBeGreaterThan(0);
    const point = await page.evaluate(
      ({ from, to, width }) => {
        for (let y = Math.round((from + to) / 2); y < to; y += 8) {
          for (let x = 24; x < width - 24; x += 16) {
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest(".maplibregl-map") && !hit.closest(".maplibregl-marker")) {
              return { x, y };
            }
          }
        }
        return null;
      },
      { from: searchBottom, to: top, width: PHONE_390.width },
    );
    if (!point) throw new Error("no bare map point between the band and the sheet");
    return point;
  }

  test("MAPUI-62: at middle, tapping the map between the top band and the sheet lowers it to peeked; on a fresh load, panning the map 80px does too", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet");
    const { sheet } = await openPhoneMap(page);
    const tap = await bareMapPoint(page, sheet);
    await page.mouse.click(tap.x, tap.y);
    await expect(sheet).toHaveAttribute("data-position", "peeked");

    await page.reload();
    const reloaded = (await openPhoneMap(page)).sheet;
    const start = await bareMapPoint(page, reloaded);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++) {
      await page.mouse.move(start.x + step * 10, start.y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await expect(reloaded).toHaveAttribute("data-position", "peeked");
  });

  test("MAPUI-62: at middle, opening the band's search shows the BUSCAR dialog and leaves the sheet at middle", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet");
    const { sheet } = await openPhoneMap(page);

    await page
      .getByRole("button", { name: /toda españa|cualquier marca|all of spain|any make/i })
      .first()
      .click();

    await expect(page.getByRole("dialog", { name: /^(buscar|search)$/i })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-position", "middle");
  });
});

// docs/specs/map-and-search.md (MAP-39): on a phone, with the browser's
// position granted, the 50 km circle around it is centred in the strip of map
// above the results sheet at middle. `es-ES` renders the page in Spanish, the
// default locale (FRONT-9).
test.describe("MAP-39: the circle around the position on a phone", () => {
  test.use({
    geolocation: { latitude: 40.4168, longitude: -3.7038 },
    permissions: ["geolocation"],
    locale: "es-ES",
  });

  test("MAP-39: on a phone, the circle around the position is centred in the strip above the results sheet", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet");
    const { sheet } = await openPhoneMap(page);
    const mapEl = page.locator('[data-map="listings"]');
    // Measured at 390×844: the map runs from y 138 to 844 (706px) and the
    // sheet at middle starts at y 260, 122px into the map — the spec's layout.
    expectWithin((await box(mapEl)).height, 706, "map height");
    expectWithin((await box(sheet)).y - (await box(mapEl)).y, 122, "sheet top in the map");
    // The «Dónde» segment, with the U+00A0 the messages put before «km».
    await expect(page.getByRole("button", { name: /Tu ubicación · 50\skm/ }).first()).toBeVisible();

    // Hand-derived. The position is rounded to (40.42, −3.70) (MAP-35); 50 km
    // is 0.4497° of latitude (39.9703 to 40.8697) and 0.5906° of longitude
    // either side, so the circle spans 1.1813° across. Padding 56 leaves
    // 390 − 112 = 278px for it: 278 = 1.1813 / 360 × 512 × 2^z gives z ≈ 7.37
    // (the 594px left upright is not the limit), 512 × 2^7.37 / 2π ≈ 13,500px
    // per Mercator radian. The circle's Mercator middle is 40.4215; the offset
    // 122 / 2 − 706 / 2 = −292px puts it 292px above the map's centre, so the
    // centre is 292 / 13,500 ≈ 0.0216 Mercator radians south of it, latitude
    // 39.4703. Within 0.03° (about 9px at this zoom) of that, on the −3.70 meridian; the
    // circle merely framed (no offset) would read 40.4215.
    await expect
      .poll(async () => {
        const center = (await mapEl.getAttribute("data-map-center")) ?? "";
        const [lat, lng] = center.split(",").map(Number);
        return Math.abs(lat - 39.4703) < 0.03 && Math.abs(lng + 3.7) < 0.002;
      })
      .toBe(true);
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-16: the desktop
// «Filtros» dropdown, opened and closed with a pointer — Escape removes it
// within two animation frames, and a reopen closed by an outside click is
// still visible, fading, on the next frame, gone within 300ms (the worked
// example «Filtros», MOTION-10/MOTION-16's second and third rows).
test.describe("MOTION-16: the «Filtros» dropdown closes with Escape within two frames, and fades out over a pointer close", () => {
  /** Waits two animation frames: what an instant close needs to be drawn, and far too little for a 180ms fade. */
  async function twoFrames(page: Page) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
  }

  test("MOTION-16: Escape removes the dropdown within two animation frames", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only filters dropdown");
    await gotoMap(page, DESKTOP_1440);
    const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
    // Hidden elements included: a card still fading out is aria-hidden (PopoverCard).
    const dropdown = page.getByRole("dialog", { name: FILTERS_NAME, includeHidden: true });

    await filtersButton.click();
    await expect(dropdown).toBeVisible();

    await page.keyboard.press("Escape");
    await twoFrames(page);

    // Counted once, right after the two frames: a retrying assertion would also accept a fade.
    expect(await dropdown.count()).toBe(0);
  });

  test("MOTION-16: reopened with a click and closed with a click outside, the dropdown is still visible with an opacity below 1 on the next frame, and gone within 300ms", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop-only filters dropdown");
    await gotoMap(page, DESKTOP_1440);
    const filtersButton = page.getByRole("button", { name: FILTERS_NAME }).first();
    // While it fades out the card is aria-hidden and inert (PopoverCard), so
    // the closing dropdown is only found with the hidden elements included.
    const dropdown = page.getByRole("dialog", { name: FILTERS_NAME, includeHidden: true });

    await filtersButton.click();
    await expect(dropdown).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeAttached();

    await filtersButton.click();
    await expect(dropdown).toBeVisible();

    // Every frame after the press is read inside the page (watchFrames): a
    // read two frames later from here raced the 180ms fade on a loaded runner.
    const watch = await watchFrames(dropdown);
    // Outside the pill and the dropdown: the header band's padding.
    await page.mouse.click(20, 20);

    const watched = await framesWatched(watch);
    expect(watched.frames.length, "still drawn on a frame after the press").toBeGreaterThan(0);
    expect(
      watched.frames[0]?.opacity,
      "visible on the first frame after the press",
    ).toBeGreaterThan(0);
    expect(fadeOutLength(watched), "gone within 300ms of its fade starting").toBeLessThan(300);
  });
});

// docs/specs/redesign-map.md (MAPUI-27); docs/specs/motion.md
// (MOTION-11); docs/specs/map-maplibre.md (MAPLIBRE-6, MAPLIBRE-8). The
// desktop preview's open, close, focus and Escape lifecycle, in a real
// browser on the real MapLibre map — ported from the removed
// components/map/ListingsMap.preview.test.tsx, which ran real Leaflet in
// jsdom. The cases that assert a callback, a re-render with new props or a
// class stayed in components/map/ListingsMap.test.tsx against the stand-in.
test.describe("MAPUI-27: the desktop preview's lifecycle on the MapLibre map", () => {
  const PREVIEW_NAME = /^(Audi A3 2\.0 TDI|BMW Serie 3 320d)$/;
  const CLOSE_NAME = /^(cerrar vista previa|close preview)$/i;
  const AUDI_PIN = /^Audi A3 2\.0 TDI, /;
  const BMW_PIN = /^BMW Serie 3 320d, /;

  /** Waits two animation frames: what an instant open or close needs to be drawn, and far too little for a 180ms fade. */
  async function twoFrames(page: Page) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
  }

  /** /map at 1440×900 with the three stubbed cars, their pins drawn. */
  async function openDesktopMap(page: Page) {
    await gotoMap(page, DESKTOP_1440);
    const mapEl = page.locator('[data-map="listings"]');
    const pins = mapEl.locator(".maplibregl-marker");
    await expect(pins).toHaveCount(3);
    return {
      mapEl,
      audi: pins.getByRole("button", { name: AUDI_PIN }),
      bmw: pins.getByRole("button", { name: BMW_PIN }),
      // Hidden elements included: a card fading out is still the preview.
      preview: page.locator(".maplibregl-popup").getByRole("dialog", {
        name: PREVIEW_NAME,
        includeHidden: true,
      }),
    };
  }

  /** A point on the bare map: on its canvas, on no pin, popup or control. */
  async function bareMapPoint(page: Page, mapEl: Locator): Promise<{ x: number; y: number }> {
    const mapBox = await box(mapEl);
    const point = await page.evaluate(({ x, y, width, height }) => {
      for (let top = y + 24; top < y + height - 24; top += 16) {
        for (let left = x + 24; left < x + width - 24; left += 16) {
          const hit = document.elementFromPoint(left, top);
          if (hit?.classList.contains("maplibregl-canvas")) return { x: left, y: top };
        }
      }
      return null;
    }, mapBox);
    if (!point) throw new Error("no bare map point");
    return point;
  }

  for (const [key, press] of [
    ["Enter", "Enter"],
    ["Space", " "],
  ] as const) {
    test(`MAPUI-27: ${key} on a pin opens its preview, activates its car and moves focus into it`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
      const { audi, preview } = await openDesktopMap(page);

      await audi.focus();
      await page.keyboard.press(press);

      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Audi A3 2.0 TDI");
      await expect(audi).toHaveAttribute("data-active", "true");
      await expect(preview.getByRole("button", { name: CLOSE_NAME })).toBeFocused();
    });
  }

  test("MAPUI-27: Escape inside the preview closes it and returns focus to the pin", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview.getByRole("button", { name: CLOSE_NAME })).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(preview).toHaveCount(0);
    await expect(audi).toBeFocused();
    await expect(audi).toHaveAttribute("data-active", "false");
  });

  test("MAPUI-27: Escape on the pin closes its preview", async ({ page, isMobile }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();

    await audi.focus();
    await page.keyboard.press("Escape");

    await expect(preview).toHaveCount(0);
    await expect(audi).toBeFocused();
  });

  test("MAPUI-27: the close button closes it and returns focus to the pin", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toBeVisible();

    await preview.getByRole("button", { name: CLOSE_NAME }).click();

    await expect(preview).toHaveCount(0);
    await expect(audi).toBeFocused();
  });

  test("MAPUI-27: a press on the map outside the preview closes it and returns focus to the pin", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { mapEl, audi, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toBeVisible();

    const point = await bareMapPoint(page, mapEl);
    await page.mouse.click(point.x, point.y);

    await expect(preview).toHaveCount(0);
    await expect(audi).toBeFocused();
  });

  test("MAPUI-27: a press on the page outside the map closes it too", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toBeVisible();

    await page.getByRole("heading", { level: 1 }).click();

    await expect(preview).toHaveCount(0);
  });

  test("MAPUI-27: a press inside the preview leaves it open", async ({ page, isMobile }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toBeVisible();

    await preview.getByText("Audi A3 2.0 TDI").click();
    await twoFrames(page);

    await expect(preview).toBeVisible();
    expect(await preview.count()).toBe(1);
  });

  test("MAPLIBRE-6: a pin near the map's top edge opens a preview that sits fully inside the map", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { mapEl, bmw, preview } = await openDesktopMap(page);
    const mapBox = await box(mapEl);

    // A bare point low on the map, so the drag below has room to lift the map.
    const start = await page.evaluate(({ x, y, width, height }) => {
      for (let top = y + height - 40; top > y + 24; top -= 16) {
        for (let left = x + 24; left < x + width - 24; left += 16) {
          const hit = document.elementFromPoint(left, top);
          if (hit?.classList.contains("maplibregl-canvas")) return { x: left, y: top };
        }
      }
      return null;
    }, mapBox);
    if (!start) throw new Error("no bare map point");

    // Drag the map until the BMW pin sits 40px under the map's top edge; the
    // pause before releasing leaves the drag no speed to carry on with.
    const pinBox = await box(bmw);
    const lift = pinBox.y + pinBox.height / 2 - (mapBox.y + 40);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - lift, { steps: 20 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect
      .poll(async () => {
        const pin = await box(bmw);
        return pin.y + pin.height / 2 - mapBox.y;
      })
      .toBeLessThanOrEqual(60);

    await bmw.click();
    await expect(preview).toBeVisible();

    await expect.poll(async () => wholly(await box(preview), mapBox)).toBe(true);
  });

  test("MAPUI-27: reopened and closed again, one Escape still closes it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(audi).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(preview).toHaveCount(0);
    await expect(audi).toBeFocused();
  });

  test("MAPUI-27: opening another pin's preview leaves the focus in that preview, not on the first pin", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, bmw, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toContainText("Audi A3 2.0 TDI");

    await bmw.focus();
    await page.keyboard.press("Enter");

    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText("BMW Serie 3 320d");
    await expect(preview.getByRole("button", { name: CLOSE_NAME })).toBeFocused();
    await expect(audi).not.toBeFocused();
  });

  test("MAPUI-27: pressing another pin fades the first out and opens the second, which survives the first's exit", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, bmw, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toContainText("Audi A3 2.0 TDI");

    await bmw.click();

    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText("BMW Serie 3 320d");
    // Past the first one's 180ms exit: the second is still open.
    await page.waitForTimeout(400);
    await expect(preview).toContainText("BMW Serie 3 320d");
    await expect(bmw).toHaveAttribute("data-active", "true");
  });

  test("MAPUI-27: the close button keeps the card mounted until the exit finishes, then removes it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.click();
    await expect(preview).toBeVisible();
    // Past the 180ms fade in, so the exit starts from a whole card.
    await page.waitForTimeout(300);

    // Every frame after the press is read inside the page (watchFrames): a
    // read two frames later from here raced the 180ms fade on a loaded runner.
    const watch = await watchFrames(preview);
    await preview.getByRole("button", { name: CLOSE_NAME }).click();

    const watched = await framesWatched(watch);
    expect(watched.frames.length, "still mounted on a frame after the press").toBeGreaterThan(0);
    expect(fadeOutLength(watched), "removed within 300ms of its fade starting").toBeLessThan(300);
  });

  test("MAPUI-27: activating the pin of an open preview again closes it and leaves the pin inactive", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();
    await expect(audi).toHaveAttribute("data-active", "true");

    await audi.focus();
    await page.keyboard.press("Enter");

    await expect(preview).toHaveCount(0);
    await expect(audi).toHaveAttribute("data-active", "false");
  });

  test("MOTION-11: Enter on a pin draws the preview whole within two frames, with no fade", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();

    await page.keyboard.press("Enter");
    await twoFrames(page);

    // Read once, right after the two frames: a retrying assertion would also accept a fade.
    const opacity = await preview.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBe(1);
  });

  test("MOTION-11: Escape removes the preview within two animation frames", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();

    await page.keyboard.press("Escape");
    await twoFrames(page);

    expect(await preview.count()).toBe(0);
  });

  test("MOTION-11: a pointer open still fades in, below full opacity as it appears", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);

    // The card's opacity read the moment it is inserted, before any frame is
    // drawn: below 1 when it fades in, 1 when it is drawn whole at once. A
    // read on a later frame raced the 180ms fade, and on a loaded runner the
    // first frame after the click could already show it finished.
    const inserted = await page.evaluateHandle(() => {
      const state = { opacity: -1 };
      const observer = new MutationObserver(() => {
        const card = document.querySelector('.maplibregl-popup [role="dialog"]');
        if (!card) return;
        state.opacity = Number.parseFloat(getComputedStyle(card).opacity);
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return state;
    });

    await audi.click();

    await expect
      .poll(() => inserted.evaluate((state) => state.opacity), { message: "the card was inserted" })
      .toBeGreaterThanOrEqual(0);
    expect(await inserted.evaluate((state) => state.opacity)).toBeLessThan(1);
    // …and the fade ends with the card whole.
    await expect
      .poll(() => preview.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity)))
      .toBe(1);
  });

  test("MAPUI-27: the open preview card has no serious or critical axe violation", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the preview is desktop-only (MAPUI-24)");
    const { audi, preview } = await openDesktopMap(page);
    await audi.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).include(".maplibregl-popup").analyze();
    const serious = violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });
});
