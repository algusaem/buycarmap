import { test, expect, type Locator, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";
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

/**
 * A control's touch target. Its own drawn box can be smaller: the pins, the
 * phone «Filtros» chip (FilterRow.tsx), the price knobs (PriceRange.tsx) and
 * the «Cambio» options (RadioChips.tsx) keep the 44px floor with an invisible
 * `::before` hit-area extension instead of growing their visible size (RULES
 * §19). The real hit area is the larger of the drawn box and that
 * pseudo-element's computed size.
 */
async function hitArea(target: Locator): Promise<{ width: number; height: number }> {
  return target.evaluate((el) => {
    const own = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const hasHitArea = before.content !== "none" && before.position === "absolute";
    return {
      width: Math.max(own.width, hasHitArea ? Number.parseFloat(before.width) || 0 : 0),
      height: Math.max(own.height, hasHitArea ? Number.parseFloat(before.height) || 0 : 0),
    };
  });
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
