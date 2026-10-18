import { test, expect, type Locator, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";
import { dragDown, sheetOffset } from "./fixtures/drag";
import { box, expectWithin, hitArea, settledBox } from "./fixtures/measure";
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
  // The pin's marker is a zero-size point (ListingsMap.tsx), so the visible
  // part is its price pill.
  await expect(
    page.getByRole("button", { name: /Audi A3 2\.0 TDI/ }).locator("span"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /BMW Serie 3 320d/ }).locator("span"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /SEAT León 1\.5 TSI/ }).locator("span"),
  ).toBeVisible();
});

test("renders the Leaflet map surface", async ({ page, isMobile }) => {
  // This checks the desktop layout, the map beside the list. A phone keeps the
  // map on screen under the top band and the results sheet, which the
  // MAPUI-20 to MAPUI-24 cases cover.
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

// docs/specs/redesign-map.md (MAPUI-49, MAPUI-50, MAPUI-51). Moved here from
// the former e2e/map-search.spec.ts: this file's name matches the "mobile"
// project's testMatch (playwright.config.ts), so these run under both
// chromium and mobile without a config change. Desktop-only and phone-only
// cases are gated with `isMobile`, the same way "renders the Leaflet map
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
    // A pin's own element is Leaflet's zero-size marker point (ListingsMap.tsx's
    // pinIcon): it carries the role, the aria-label and the click, but no box
    // of its own, so it reads as invisible. Its visible pill — the marker's
    // only child — is what a finger actually lands on, so that is what gets
    // measured instead of skipping the pin.
    const isPin = await control.evaluate((el) => el.classList.contains("leaflet-marker-icon"));
    const target = isPin ? control.locator("span").first() : control;

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
      // The pin's element is a zero-size point; its price pill takes the press.
      await page
        .getByRole("button", { name: /Audi A3 2\.0 TDI/ })
        .locator("span")
        .click();
      const preview = page.getByRole("article", { name: /vista previa del coche|car preview/i });
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

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The summary still reads the search it had, not the discarded choice.
    await expect(summary).toHaveText(summaryBefore);
    await expect(page).toHaveURL(before);
    expect(page.url()).not.toContain("make=Toyota");
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
    expect(Math.abs((await sheetOffset(sheet)) - 40)).toBeLessThanOrEqual(1);
    await page.mouse.up();
    await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
    await expect(sheet).toBeVisible();

    await dragDown(page, sheet.getByText(/^(dónde|where)$/i).first(), 150, { hold: true });
    expect(await sheetOffset(sheet)).toBe(0);
    await page.mouse.up();
    await expect(sheet).toBeVisible();
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
    expectWithin(
      filtersBox.x - (DESKTOP_1440.width - (kmBox.x + kmBox.width)),
      0,
      "row two centred on the window",
    );

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
    expectWithin(
      filtersBox.x - (DESKTOP_2560.width - (kmBox.x + kmBox.width)),
      0,
      "row two centred on the window",
    );
  });
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
