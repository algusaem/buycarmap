import { test, expect, type Locator, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";
import { dragDown, sheetOffset } from "./fixtures/drag";
import { box, expectWithin, hitArea, scrollableAncestor } from "./fixtures/measure";
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
  // map on screen under the floating search and the results sheet, which the
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
const PHONE_390 = { width: 390, height: 844 };

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

    await page
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

test.describe("MAPUI-51: phone touch targets", () => {
  test("MAPUI-51: the summary, the filters button, the chips' remove buttons, the sheet handle, the pins and the tabs all clear 44x44px", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only touch-target check");
    await page.setViewportSize(MOBILE);
    await mockListingSources(page);
    await page.goto("/map?engine=gasoil");

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

/** The sheet's offset once it stops moving, with `data-position` at `position`. */
async function settledOffset(sheet: Locator, position: keyof SheetOffsets): Promise<number> {
  await expect(sheet).toHaveAttribute("data-position", position);
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const current = await sheetOffset(sheet);
      const still = Math.abs(current - previous) < 0.5;
      previous = current;
      return still;
    })
    .toBe(true);
  return previous;
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
  await expect(page.locator(".leaflet-container")).toBeVisible();
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

  /** Waits two animation frames: what a jump needs to be drawn, and far too little for a spring. */
  async function twoFrames(page: Page) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
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
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, handle, middle } = await openPhoneMap(page);
    const offsets = await measureOffsets(sheet, handle, middle);

    // Released slowly this would settle back at middle: only the speed moves it.
    expect(60).toBeLessThan((offsets.middle - offsets.full) / 2);
    await dragDown(page, sheet.getByRole("heading", { level: 1 }), -60, { fast: true });

    await settledOffset(sheet, "full");
  });

  test("MAPUI-60: a fast 60px drag of the handle down from full, shorter than half of M−F, ends at middle", async ({
    page,
    isMobile,
  }) => {
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await openPhoneMap(page);
    await reduced.handle.click();
    await expect(reduced.sheet).toHaveAttribute("data-position", "full");
    await twoFrames(page);
    expect(await sheetOffset(reduced.sheet)).toBeLessThan(0.5);

    // The control: with motion allowed the same press springs.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const animated = await openPhoneMap(page);
    await animated.handle.click();
    await expect(animated.sheet).toHaveAttribute("data-position", "full");
    await twoFrames(page);
    expect(await sheetOffset(animated.sheet)).toBeGreaterThan(0.5);
  });

  test("MAPUI-59: a drag that starts in the list does not move the sheet, not even mid-drag", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone-only results sheet drag");
    const { sheet, middle } = await openPhoneMap(page);

    const card = sheet.getByRole("article").first();
    await dragDown(page, card, -200, { hold: true });
    expectWithin(await sheetOffset(sheet), middle, "offset still at middle mid-drag");
    await page.mouse.up();

    await expect(sheet).toHaveAttribute("data-position", "middle");
  });

  test("MAPUI-59: at full, scrolling inside the list scrolls the list and leaves the sheet at full", async ({
    page,
    isMobile,
  }) => {
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
   * A point on the bare map between the floating search's lower edge and the
   * middle sheet's top edge: inside the Leaflet container and on no pin.
   */
  async function bareMapPoint(page: Page, sheet: Locator): Promise<{ x: number; y: number }> {
    const search = await box(page.locator(".top-float-top"));
    const top = (await box(sheet)).y;
    const searchBottom = search.y + search.height;
    expect(top - searchBottom, "room between the search and the sheet").toBeGreaterThan(0);
    const point = await page.evaluate(
      ({ from, to, width }) => {
        for (let y = Math.round((from + to) / 2); y < to; y += 8) {
          for (let x = 24; x < width - 24; x += 16) {
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest(".leaflet-container") && !hit.closest(".leaflet-marker-icon")) {
              return { x, y };
            }
          }
        }
        return null;
      },
      { from: searchBottom, to: top, width: PHONE_390.width },
    );
    if (!point) throw new Error("no bare map point between the search and the sheet");
    return point;
  }

  test("MAPUI-62: at middle, tapping the map between the floating search and the sheet lowers it to peeked; on a fresh load, panning the map 80px does too", async ({
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

  test("MAPUI-62: at middle, opening the floating search shows the BUSCAR dialog and leaves the sheet at middle", async ({
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
