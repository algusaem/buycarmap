import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

// e2e/location-search.spec.ts:9-15, verbatim: the Nominatim fixture result
// for "Madrid".
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search**";
const MADRID_RESULT = {
  place_id: 1,
  display_name: "Madrid, Comunidad de Madrid, España",
  lat: "40.4168",
  lon: "-3.7038",
  address: { city: "Madrid", state: "Comunidad de Madrid" },
};

// docs/specs/redesign-entry.md. ENTRY-3's e2e half (the component half lives
// in components/landing/LandingSearch.test.tsx) and ENTRY-21's illustration
// half (ENTRY-21's axe half amends e2e/a11y.spec.ts instead). Desktop-only,
// the same `isMobile` skip e2e/map.spec.ts's MAPUI-49/MAPUI-50 pair uses:
// Populares and the desktop Dónde/Coche/Precio pill are both desktop-only
// (ENTRY-2, ENTRY-4).
const DESKTOP = { width: 1280, height: 800 };

test.beforeEach(async ({ page }) => {
  await mockListingSources(page);
});

test.describe("ENTRY-3: the landing search hands its choice to the map", () => {
  test("ENTRY-3: Buscar with BMW chosen lands on /map?make=BMW, showing the BMW segment", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await page.getByRole("button", { name: /^(marca o modelo…|make or model…)$/i }).click();
    await page.getByRole("combobox", { name: /marca o modelo|make or model/i }).fill("BMW");
    await page.getByRole("option", { name: "BMW" }).click();
    await page.getByRole("button", { name: /^(buscar|search)$/i }).click();

    await expect(page).toHaveURL(/\/map\?make=BMW$/);
    await expect(page.getByRole("button", { name: "BMW", exact: true })).toBeVisible();
  });

  test("ENTRY-3: a Populares chip lands on /map with its brand and model", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await page.getByRole("link", { name: "Golf" }).click();

    await expect(page).toHaveURL(/\/map\?.*make=Volkswagen/);
    await expect(page).toHaveURL(/model=Golf/);
    await expect(page.getByRole("button", { name: "Volkswagen Golf", exact: true })).toBeVisible();
  });

  // (F4 review round 1). A place, a car and a price together, through the
  // same desktop pill as the two tests above. Asserted in both locales with
  // a regex rather than forcing Spanish: no e2e spec in this repo forces a
  // locale via NEXT_LOCALE or the `locale` cookie (lib/i18n/config.ts), so
  // there is no existing pattern to follow (RULES.md §1 would otherwise call
  // for a new one, out of scope for a review-round fix).
  test("ENTRY-3: a place, a brand and a price together land on /map with all of them", async ({
    page,
  }) => {
    await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));
    await page.setViewportSize(DESKTOP);
    await page.goto("/");

    await page.getByRole("button", { name: /ciudad o código postal|city or postcode/i }).click();
    const locationInput = page.getByPlaceholder(/ciudad o código postal|city or postcode/i);
    await locationInput.fill("Madrid");
    await page.getByRole("option", { name: /Madrid/ }).click();

    await page.getByRole("button", { name: /^(marca o modelo…|make or model…)$/i }).click();
    await page.getByRole("combobox", { name: /marca o modelo|make or model/i }).fill("Volkswagen");
    await page.getByRole("option", { name: "Volkswagen" }).click();
    // e2e/fixtures/network.ts's model fixtures carry "Golf" for both
    // Wallapop and coches.net; choosing it (rather than the brand alone)
    // closes the popover itself, the same as the real app (CarPopover.tsx's
    // `onSelectModel`).
    await page.getByRole("option", { name: "Golf" }).click();

    await page.getByRole("button", { name: /^(cualquiera|any)$/i }).click();
    // The radio itself is visually `sr-only`, under a `<label>` whose own
    // 44px invisible hit-area pseudo-element intercepts Playwright's actionability
    // check on the input — click the label (the accessible name resolves to
    // it) instead of `.check()`ing the input directly.
    await page.getByText(/hasta\s*10\.000\s*€|up to\s*€?10,000/i).click({ force: true });

    await page.getByRole("button", { name: /^(buscar|search)$/i }).click();

    await expect(page).toHaveURL(/\/map\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("lat")).toBe("40.4168");
    expect(url.searchParams.get("lng")).toBe("-3.7038");
    expect(url.searchParams.get("placeId")).toBe("1");
    // PlaceField.tsx:141 stores only `splitPlace(result.displayName).place`
    // — the bare city, not the Nominatim fixture's full "Madrid, Comunidad
    // de Madrid" — so the URL carries that split place.
    expect(url.searchParams.get("locationName")).toBe("Madrid");
    expect(url.searchParams.get("radius")).toBe("50");
    expect(url.searchParams.get("make")).toBe("Volkswagen");
    expect(url.searchParams.get("model")).toBe("Golf");
    expect(url.searchParams.get("maxPrice")).toBe("10000");

    await expect(page.getByRole("button", { name: /Madrid.*50\s*km/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Volkswagen Golf", exact: true })).toBeVisible();
    // The exact English string (`formatPrice(10000, "en")` evaluated in
    // node: "€10,000") alongside the exact Spanish one
    // (`formatPrice(10000, "es")`: "10.000 €"), each wrapped by
    // `search.priceUpTo` — anchored, rather than the looser unanchored
    // regex that would also match a stray "10,000" or "10.000" elsewhere.
    await expect(
      page.getByRole("button", { name: /^(Hasta\s*10\.000\s*€|Up to\s*€10,000)$/ }),
    ).toBeVisible();
  });
});

// (F4 review round 1): ENTRY-5's phone card, forced to a phone viewport
// inside the chromium project rather than the separate "mobile" project
// (playwright.config.ts) — no `isMobile` skip, so this always runs with the
// viewport it sets, regardless of which project picked the file up.
test.describe("ENTRY-5: the phone landing card opens the BUSCAR sheet", () => {
  test("ENTRY-5: filling Máximo and Ver coches lands on /map?maxPrice=15000, with the sheet gone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockListingSources(page);
    await page.goto("/");

    await page.getByTestId("landing-search-phone").click();
    await expect(page.getByRole("dialog", { name: /^(buscar|search)$/i })).toBeVisible();

    const maxPriceInput = page.getByRole("textbox", { name: /^(máximo|maximum)$/i });
    await maxPriceInput.fill("15000");
    await maxPriceInput.blur();
    await page.getByRole("button", { name: /^(ver coches|show cars)$/i }).click();

    await expect(page).toHaveURL(/\/map\?maxPrice=15000/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

// ENTRY-21's illustration half: "the illustrations load under the page's
// CSP" — same-origin <img>s should resolve with a real 2xx response and
// decode to a non-zero size, not silently 404 or get blocked by the CSP
// connect-src/img-src directive.
async function expectImageLoads(page: Page, srcSubstring: string) {
  const image = page.locator(`img[src*="${srcSubstring}"]:visible`).first();
  await expect(image).toBeVisible();
  const [status, naturalWidth] = await image.evaluate(async (element: HTMLImageElement) => {
    const response = await fetch(element.currentSrc || element.src);
    return [response.status, element.naturalWidth];
  });
  expect(status).toBe(200);
  expect(naturalWidth).toBeGreaterThan(0);
}

test.describe("ENTRY-21: the landing and sign-in illustrations load", () => {
  test("ENTRY-21: vehicle-sale-lime.svg loads on /", async ({ page }) => {
    await page.goto("/");
    await expectImageLoads(page, "vehicle-sale-lime.svg");
  });

  test("ENTRY-21: by-my-car-lime.svg loads on /login", async ({ page }) => {
    // ENTRY-29 hides the illustration at the project's default 1280×720 (the
    // room is ~78px, under the 150px minimum), so widen the viewport to show
    // it and still check its load under CSP.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/login");
    await expectImageLoads(page, "by-my-car-lime.svg");
  });
});

// docs/specs/redesign-entry.md (ENTRY-23 to ENTRY-27, "Layout by viewport",
// amended 2026-10-14). The section preamble: phone is under 1024px, laptop
// 1024-1439px, desktop 1440px and up; "centred" means the horizontal centre
// of the element's rendered content — for text, the union of its rendered
// lines — is within 1px of the centre of the page's scrolling area (its
// client width, without the scrollbar). `main` is the only element that
// scrolls on `/` and `/login` (both pages' `overflow-y-auto main`,
// app/page.tsx, app/login/page.tsx), so its `clientWidth` is that scrolling
// area.
const LAPTOP_900 = { width: 1024, height: 900 };
const LAPTOP_1439 = { width: 1439, height: 900 };
const DESKTOP_1440 = { width: 1440, height: 900 };
const PHONE_390 = { width: 390, height: 844 };
const SHORT_1024 = { width: 1024, height: 600 };
// ENTRY-29's two derived rows (not boards, Worked examples › "Room and the
// 150px minimum"): the room is above the cap at 760 and under it at 700.
const LAPTOP_760 = { width: 1024, height: 760 };
const LAPTOP_700 = { width: 1024, height: 700 };

// The app negotiates the locale from the browser's Accept-Language header
// (no NEXT_LOCALE/`locale` cookie is forced anywhere in this repo's e2e
// suite — see this file's own ENTRY-3 comment above), and Playwright's
// Chromium runs with "en-US" by default, so these pages render in English
// here even though the default locale is Spanish. Every text matcher below
// accepts both, case-insensitively, the same convention `/^(buscar|search)$/i`
// above already uses.
const VER_EL_MAPA = /^(ver el mapa|explore the map)$/i;
const SUBTITLE_TEXT = /una web, toda la segunda mano|one site, every second-hand listing/i;
const FORGOT_PASSWORD = /^(¿la olvidaste\?|forgot it\?)$/i;
const SIGN_IN = /^(entrar|sign in)$/i;
const CREATE_ONE = /^(créala|create one)$/i;
const OR_DIVIDER = /^(o|or)$/i;
const CONTINUE_WITH_GOOGLE = /continuar con google|continue with google/i;
const NO_ACCOUNT_LINE = /¿no tienes cuenta\?|no account\?/i;
const LOGIN_TAGLINE = /recibir alertas es gratis|alerts are free/i;

/** The centre x of the scrolling container (`main`), in viewport coordinates. */
async function scrollContainerCenterX(page: Page): Promise<number> {
  return page.locator("main").evaluate((main) => {
    const rect = main.getBoundingClientRect();
    return rect.left + main.clientWidth / 2;
  });
}

/**
 * The horizontal centre of an element's rendered content: for a text block
 * (`isText`), the union of its text's client rects (its rendered lines);
 * otherwise the element's own bounding box.
 */
async function contentCenterX(locator: Locator, isText = false): Promise<number> {
  return locator.evaluate((el, text) => {
    if (text) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
      if (rects.length > 0) {
        const left = Math.min(...rects.map((r) => r.left));
        const right = Math.max(...rects.map((r) => r.right));
        return (left + right) / 2;
      }
    }
    const rect = el.getBoundingClientRect();
    return (rect.left + rect.right) / 2;
  }, isText);
}

/** The union bounding box of an element's direct children — Footer.tsx's
 * links row sits inside a full-width `<footer>`, right-aligned by
 * `justify-end`, so the `<footer>`'s own box always spans the page and
 * would trivially "centre" regardless of where the links actually render;
 * this measures the row the links actually draw instead. */
async function childrenUnionBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return locator.evaluate((el) => {
    const rects = Array.from(el.children).map((c) => c.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
}

// docs/specs/redesign-entry.md, Contracts › Illustrations: the viewBox
// fractions that derive each file's "drawn content" box from its own
// rendered image box, keyed by file name so one map covers both
// illustrations rather than a copy per page.
const DRAWN_CONTENT_FRACTIONS: Record<
  string,
  { left: number; right: number; top: number; bottom: number }
> = {
  "vehicle-sale-lime.svg": { left: 0.0689, right: 0.9311, top: 0.2006, bottom: 0.8816 },
  "by-my-car-lime.svg": { left: 0.0549, right: 0.9451, top: 0.243, bottom: 0.9086 },
};

type Box = { x: number; y: number; width: number; height: number };

/**
 * The illustration's "drawn content" box (docs/specs/redesign-entry.md,
 * "Illustration size, gaps and the sign-in left block"): the part of the
 * file that has ink, derived from the rendered image's own box and the
 * file's viewBox fractions above. The file name is read off the image's
 * `src` (the literal name survives whatever `/_next/image` encoding wraps
 * it in, since only the slashes around it are escaped).
 */
async function drawnContentBox(image: Locator): Promise<Box> {
  const box = await image.boundingBox();
  if (!box) throw new Error("illustration has no box");
  const src = await image.getAttribute("src");
  const fileName = src?.match(/([a-z0-9-]+\.svg)/i)?.[1];
  const fractions = fileName ? DRAWN_CONTENT_FRACTIONS[fileName] : undefined;
  if (!fractions) throw new Error(`no drawn-content fractions for illustration src "${src}"`);
  return {
    x: box.x + fractions.left * box.width,
    y: box.y + fractions.top * box.height,
    width: (fractions.right - fractions.left) * box.width,
    height: (fractions.bottom - fractions.top) * box.height,
  };
}

/** Whether two boxes overlap (share any area), rather than only touching. */
function boxesOverlap(a: Box, b: Box): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * The page's one scrolling container: the `overflow-y-auto` div that wraps
 * `main` and the footer on both pages (app/page.tsx, app/login/page.tsx) —
 * `main` itself does not scroll, so this is its parent element.
 */
function scrollContainer(page: Page): Locator {
  return page.locator("main").locator("xpath=..");
}

/**
 * `/login`'s panel — the `<form>`'s own parent element
 * (components/auth/LoginForm.tsx), which ENTRY-28 centres the left block
 * against.
 */
async function loginPanelBox(page: Page): Promise<Box> {
  const box = await page.locator("form").evaluate((form) => {
    const panel = form.parentElement;
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!box) throw new Error("could not find the panel element");
  return box;
}

// ENTRY-23: the map preview "Ver el mapa" pairs with the arrows only from
// 1440px wide; at laptop width neither shows, and the phone preview
// (ENTRY-7) is unaffected.
test.describe("ENTRY-23: the map preview and the arrows only pair from 1440px wide", () => {
  test("ENTRY-23: at 1440×900, Ver el mapa sits right of the search pill, with both arrows visible", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/");

    const preview = page.getByRole("link", { name: VER_EL_MAPA });
    await expect(preview).toBeVisible();

    const pillBox = await page.getByTestId("landing-search-desktop").boundingBox();
    const previewBox = await preview.boundingBox();
    if (!pillBox || !previewBox) throw new Error("missing pill or preview box");
    expect(previewBox.x).toBeGreaterThanOrEqual(pillBox.x + pillBox.width);

    // The two arrows: Landing.tsx's ArtLayer (the curve toward the preview,
    // the only <svg> inside [data-art-layer]) and PillArrow (the curve
    // toward "Buscar", its own unique viewBox).
    await expect(page.locator("[data-art-layer] svg")).toBeVisible();
    await expect(page.locator('svg[viewBox="654 414 96 134"]')).toBeVisible();
  });

  for (const viewport of [LAPTOP_900, LAPTOP_1439]) {
    test(`ENTRY-23: at ${viewport.width}×${viewport.height}, the map preview and both arrows are not shown`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      // getByRole excludes elements not in the accessibility tree (e.g.
      // display:none), so a count of 0 is "not in the accessibility tree".
      await expect(page.getByRole("link", { name: VER_EL_MAPA })).toHaveCount(0);
      await expect(page.locator("[data-art-layer] svg")).not.toBeVisible();
      await expect(page.locator('svg[viewBox="654 414 96 134"]')).not.toBeVisible();
    });
  }

  test("ENTRY-23: at 390×844, the phone map preview still shows", async ({ page }) => {
    await page.setViewportSize(PHONE_390);
    await page.goto("/");

    await expect(page.getByRole("link", { name: VER_EL_MAPA })).toBeVisible();
  });
});

// ENTRY-24: at laptop width, `/`'s body is one centred column: headline,
// line, pill, Populares, illustration, in that order — and the footer's
// links row sits 24px below the illustration's drawn content (amended
// 2026-10-15: measured from the drawn content, not the image's box). Holds
// at 1024×900, 1024×760 and 1024×700 (ENTRY-29's illustration is shown at
// all three).
test.describe("ENTRY-24: / is one centred column, footer 24px below the drawn content", () => {
  for (const viewport of [LAPTOP_900, LAPTOP_760, LAPTOP_700]) {
    test(`ENTRY-24: at ${viewport.width}×${viewport.height}, the headline, the line, the pill, Populares and the illustration are stacked and centred, with the footer 24px below the drawn content`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const centerX = await scrollContainerCenterX(page);

      const headline = page.getByRole("heading", { level: 1 });
      const subtitle = page.locator("p", { hasText: SUBTITLE_TEXT });
      const pill = page.getByTestId("landing-search-desktop");
      const populares = page.getByTestId("landing-popular");
      const illustration = page.locator('img[src*="/illus/"]:visible');
      const footer = page.locator("footer");

      await expect(headline).toBeVisible();
      await expect(subtitle).toBeVisible();
      await expect(pill).toBeVisible();
      await expect(populares).toBeVisible();
      await expect(illustration).toBeVisible();
      await expect(footer).toBeVisible();

      const centred: Array<[string, Locator, boolean]> = [
        ["headline", headline, true],
        ["subtitle", subtitle, true],
        ["pill", pill, false],
        ["populares", populares, false],
        ["illustration", illustration, false],
      ];
      for (const [name, locator, isText] of centred) {
        const center = await contentCenterX(locator, isText);
        expect(Math.abs(center - centerX), `${name} centre vs. page centre`).toBeLessThanOrEqual(1);
      }
      const footerRow = await childrenUnionBox(footer);
      expect(
        Math.abs(footerRow.x + footerRow.width / 2 - centerX),
        "footer links row centre vs. page centre",
      ).toBeLessThanOrEqual(1);

      const headlineBox = await headline.boundingBox();
      const subtitleBox = await subtitle.boundingBox();
      const pillBox = await pill.boundingBox();
      const popularesBox = await populares.boundingBox();
      if (!headlineBox || !subtitleBox || !pillBox || !popularesBox) {
        throw new Error("missing box");
      }

      expect(headlineBox.y, "headline above subtitle").toBeLessThan(subtitleBox.y);
      expect(subtitleBox.y, "subtitle above pill").toBeLessThan(pillBox.y);
      expect(pillBox.y, "pill above Populares").toBeLessThan(popularesBox.y);

      const drawn = await drawnContentBox(illustration);
      expect(popularesBox.y, "Populares above the illustration's drawn content").toBeLessThan(
        drawn.y,
      );

      // ENTRY-24 (amended 2026-10-15): the footer's links row top sits 24px
      // (±1px) below the drawn content's bottom, not the image box's.
      const drawnBottom = drawn.y + drawn.height;
      expect(
        Math.abs(footerRow.y - (drawnBottom + 24)),
        "footer row top 24px below the drawn content's bottom",
      ).toBeLessThanOrEqual(1);
    });
  }
});

// ENTRY-25: /login collapses to one centred 440px column from laptop width
// down to 1024px, with no panel, no "o", no form title and no Google mark;
// the two-column desktop layout (panel, border, "o", arrow) stays from
// 1440px wide.
test.describe("ENTRY-25: /login is one centred 440px column at laptop width", () => {
  test("ENTRY-25: at 1024×900, the column is 440px wide and centred, with no panel, no o, no form title and no Google mark", async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP_900);
    await page.goto("/login");

    const centerX = await scrollContainerCenterX(page);

    const headline = page.getByRole("heading", { level: 1 });
    const email = page.locator("#email");
    const password = page.locator("#password");
    const forgot = page.getByRole("link", { name: FORGOT_PASSWORD });
    const submit = page.getByRole("button", { name: SIGN_IN });
    const createAccountLink = page.getByRole("link", { name: CREATE_ONE });
    const illustration = page.locator('img[src*="/illus/"]:visible');
    // ENTRY-16: Google may not be configured in e2e (lib/app-config.ts:15,
    // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) — the assertions about it are
    // conditional on the button actually being present.
    const googleButton = page.getByRole("button", { name: CONTINUE_WITH_GOOGLE });

    await expect(headline).toBeVisible();
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(forgot).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(createAccountLink).toBeVisible();
    await expect(illustration).toBeVisible();

    const googlePresent = (await googleButton.count()) > 0;

    const entries: Array<[string, Locator]> = [
      ["headline", headline],
      ["email", email],
      ["password", password],
      ["submit", submit],
      ["createAccountLink", createAccountLink],
      ["illustration", illustration],
    ];
    if (googlePresent) entries.push(["google", googleButton]);

    const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const [name, locator] of entries) {
      const box = await locator.boundingBox();
      if (!box) throw new Error(`${name} has no box`);
      boxes[name] = box;
    }

    // Top-to-bottom order.
    expect(boxes.headline.y, "headline above email").toBeLessThan(boxes.email.y);
    expect(boxes.email.y, "email above password").toBeLessThan(boxes.password.y);
    expect(boxes.password.y, "password above submit").toBeLessThan(boxes.submit.y);
    if (googlePresent) {
      expect(boxes.submit.y, "submit above Google").toBeLessThan(boxes.google.y);
      expect(boxes.google.y, "Google above Créala").toBeLessThan(boxes.createAccountLink.y);
    } else {
      expect(boxes.submit.y, "submit above Créala").toBeLessThan(boxes.createAccountLink.y);
    }
    const illustrationDrawn = await drawnContentBox(illustration);
    expect(boxes.createAccountLink.y, "Créala above the illustration").toBeLessThan(
      illustrationDrawn.y,
    );

    // The column itself: 440px wide (±1px), centred.
    const lefts = Object.values(boxes).map((b) => b.x);
    const rights = Object.values(boxes).map((b) => b.x + b.width);
    const left = Math.min(...lefts);
    const right = Math.max(...rights);
    expect(right - left, "column width").toBeGreaterThanOrEqual(439);
    expect(right - left, "column width").toBeLessThanOrEqual(441);
    expect(
      Math.abs((left + right) / 2 - centerX),
      "column centre vs. page centre",
    ).toBeLessThanOrEqual(1);

    // The illustration itself, centred.
    const illustrationCenter = await contentCenterX(illustration);
    expect(
      Math.abs(illustrationCenter - centerX),
      "illustration centre vs. page centre",
    ).toBeLessThanOrEqual(1);

    // No panel: components/auth/LoginForm.tsx:208's root div — the <form>'s
    // own parent — has no background of its own and no border.
    const panelStyle = await page.locator("form").evaluate((form) => {
      const panel = form.parentElement;
      if (!panel) return null;
      const style = getComputedStyle(panel);
      return { backgroundColor: style.backgroundColor, borderWidth: style.borderWidth };
    });
    if (!panelStyle) throw new Error("could not find the panel element");
    expect(panelStyle.borderWidth, "panel border width").toBe("0px");
    expect(["rgba(0, 0, 0, 0)", "transparent"], "panel background colour").toContain(
      panelStyle.backgroundColor,
    );

    // No "o" divider, no "Entrar" form title, no Google mark.
    await expect(page.getByText(OR_DIVIDER)).not.toBeVisible();
    await expect(page.getByRole("heading", { name: SIGN_IN, level: 2 })).not.toBeVisible();
    if (googlePresent) {
      // GoogleSignInButton.tsx: the "G" mark sits on the `google-badge` pill,
      // the only element carrying that class inside the button.
      await expect(googleButton.locator(".bg-google-badge")).not.toBeVisible();
    }

    // The desktop header and the footer are still shown.
    await expect(page.getByTestId("header-desktop")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("ENTRY-25: at 1440×900, the two columns stay — headline left of the panel, the panel bordered, o and the arrow visible", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login");

    const headlineBox = await page.getByRole("heading", { level: 1 }).boundingBox();
    const panelBox = await page.locator("form").evaluate((form) => {
      const panel = form.parentElement;
      if (!panel) return null;
      const rect = panel.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    });
    if (!headlineBox || !panelBox) throw new Error("missing headline or panel box");
    expect(
      headlineBox.x + headlineBox.width,
      "headline wholly left of the panel",
    ).toBeLessThanOrEqual(panelBox.x);

    const borderWidth = await page.locator("form").evaluate((form) => {
      const panel = form.parentElement;
      return panel ? getComputedStyle(panel).borderWidth : null;
    });
    expect(borderWidth, "panel border width").not.toBe("0px");

    await expect(page.getByText(OR_DIVIDER)).toBeVisible();
    await expect(page.locator('svg[viewBox="0 0 280 140"]')).toBeVisible();
  });
});

// ENTRY-26: the visible illustration keeps the file's 3:2 proportions, and
// its drawn content (amended 2026-10-15: not the image's empty bands) is
// never cropped by the viewport or a scrolling ancestor once the page is
// scrolled all the way down, and (where the footer shows) sits clear of it.
// One helper for every ENTRY-26 case rather than a copy per page.
async function expectIllustrationUncropped(page: Page) {
  const image = page.locator('img[src*="/illus/"]:visible');
  await expect(image).toHaveCount(1);

  // ENTRY-26's "screen too short" edge case: scroll every scrollable
  // ancestor, and the page itself, to their end before measuring.
  await image.evaluate((el) => {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        node.scrollTop = node.scrollHeight;
        node.scrollLeft = node.scrollWidth;
      }
      node = node.parentElement;
    }
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const box = await image.boundingBox();
  if (!box) throw new Error("illustration has no box after scrolling");

  // The file's 3:2 proportions, within 1%.
  const ratio = box.width / box.height;
  expect(Math.abs(ratio - 1.5), "illustration width/height ratio vs. 1.5").toBeLessThanOrEqual(
    0.015,
  );

  const drawn = await drawnContentBox(image);

  // The drawn content wholly inside the viewport.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport size");
  expect(drawn.x, "drawn content left inside the viewport").toBeGreaterThanOrEqual(0);
  expect(drawn.y, "drawn content top inside the viewport").toBeGreaterThanOrEqual(0);
  expect(drawn.x + drawn.width, "drawn content right inside the viewport").toBeLessThanOrEqual(
    viewport.width,
  );
  expect(drawn.y + drawn.height, "drawn content bottom inside the viewport").toBeLessThanOrEqual(
    viewport.height,
  );

  // The drawn content wholly inside every ancestor whose overflow-x or
  // overflow-y isn't visible.
  const ancestorBoxes = await image.evaluate((el) => {
    const boxes: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        const rect = node.getBoundingClientRect();
        boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
      node = node.parentElement;
    }
    return boxes;
  });
  for (const ancestor of ancestorBoxes) {
    expect(drawn.x, "drawn content inside a clipping ancestor (left)").toBeGreaterThanOrEqual(
      ancestor.left,
    );
    expect(drawn.y, "drawn content inside a clipping ancestor (top)").toBeGreaterThanOrEqual(
      ancestor.top,
    );
    expect(
      drawn.x + drawn.width,
      "drawn content inside a clipping ancestor (right)",
    ).toBeLessThanOrEqual(ancestor.right);
    expect(
      drawn.y + drawn.height,
      "drawn content inside a clipping ancestor (bottom)",
    ).toBeLessThanOrEqual(ancestor.bottom);
  }

  const footer = page.locator("footer");
  if (await footer.isVisible()) {
    const footerBox = await footer.boundingBox();
    if (!footerBox) throw new Error("footer has no box");
    expect(drawn.y, "drawn content top above the footer's top").toBeLessThan(footerBox.y);

    const linkBoxes = await footer.getByRole("link").evaluateAll((links) =>
      links.map((link) => {
        const rect = link.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      }),
    );
    for (const link of linkBoxes) {
      expect(boxesOverlap(drawn, link), "drawn content does not overlap a footer link").toBe(false);
    }
  }
}

test.describe("ENTRY-26: the illustration is never cropped", () => {
  test("ENTRY-26: / at 1440×900", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/");
    await expectIllustrationUncropped(page);
  });

  for (const viewport of [LAPTOP_900, LAPTOP_760, LAPTOP_700]) {
    test(`ENTRY-26: / at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expectIllustrationUncropped(page);
    });
  }

  test("ENTRY-26: /login at 1440×900", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login");
    await expectIllustrationUncropped(page);
  });

  test("ENTRY-26: /login at 1024×900", async ({ page }) => {
    await page.setViewportSize(LAPTOP_900);
    await page.goto("/login");
    await expectIllustrationUncropped(page);
  });

  test("ENTRY-26: /login at 390×844", async ({ page }) => {
    await page.setViewportSize(PHONE_390);
    await page.goto("/login");
    await expectIllustrationUncropped(page);
  });

  // ENTRY-26 (amended 2026-10-15): the earlier rule — the page scrolls at
  // 1024×600 to reach the whole illustration — goes. The illustration is
  // dropped instead (ENTRY-29's under-150px case), so the page does not
  // scroll, and the content that remains (headline, line, pill, Populares)
  // stays centred, with the footer's links 24px below Populares' bottom.
  test("ENTRY-26: / at 1024×600, no illustration and no scroll", async ({ page }) => {
    await page.setViewportSize(SHORT_1024);
    await page.goto("/");

    await expect(page.locator('img[src*="/illus/"]:visible')).toHaveCount(0);

    const scrollMetrics = await scrollContainer(page).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollMetrics.scrollHeight, "the page does not scroll").toBeLessThanOrEqual(
      scrollMetrics.clientHeight + 1,
    );

    const centerX = await scrollContainerCenterX(page);
    const headline = page.getByRole("heading", { level: 1 });
    const subtitle = page.locator("p", { hasText: SUBTITLE_TEXT });
    const pill = page.getByTestId("landing-search-desktop");
    const populares = page.getByTestId("landing-popular");
    const footer = page.locator("footer");

    const centred: Array<[string, Locator, boolean]> = [
      ["headline", headline, true],
      ["subtitle", subtitle, true],
      ["pill", pill, false],
      ["populares", populares, false],
    ];
    for (const [name, locator, isText] of centred) {
      const center = await contentCenterX(locator, isText);
      expect(Math.abs(center - centerX), `${name} centre vs. page centre`).toBeLessThanOrEqual(1);
    }

    const footerRow = await childrenUnionBox(footer);
    expect(
      Math.abs(footerRow.x + footerRow.width / 2 - centerX),
      "footer links row centre vs. page centre",
    ).toBeLessThanOrEqual(1);

    const popularesBox = await populares.boundingBox();
    if (!popularesBox) throw new Error("missing Populares box");
    expect(
      Math.abs(footerRow.y - (popularesBox.y + popularesBox.height) - 24),
      "footer row top 24px below Populares' bottom",
    ).toBeLessThanOrEqual(1);
  });

  // ENTRY-26 (amended 2026-10-15): /login's form alone does not fit at
  // 1024×600, so the page still scrolls — but only for the form, not to
  // reach an illustration (there is none).
  test("ENTRY-26: /login at 1024×600, no illustration, the page scrolls only for the form", async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_1024);
    await page.goto("/login");

    await expect(page.locator('img[src*="/illus/"]:visible')).toHaveCount(0);

    const headerBox = await page.locator("header").boundingBox();
    const containerScrollHeight = await scrollContainer(page).evaluate((el) => el.scrollHeight);
    const pageHeight = (headerBox?.height ?? 0) + containerScrollHeight;
    expect(pageHeight, "the page is at most 655px tall (+1px)").toBeLessThanOrEqual(656);
  });
});

// ENTRY-27: at phone width, /login's illustration sits under "¿No tienes
// cuenta? Créala", centred.
test.describe("ENTRY-27: at 390×844, /login's illustration sits under Créala, centred", () => {
  test("ENTRY-27: the illustration is centred and starts at or below the Créala line's bottom", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE_390);
    await page.goto("/login");

    const centerX = await scrollContainerCenterX(page);
    const illustration = page.locator('img[src*="/illus/"]:visible');
    const createAccountLine = page.getByText(NO_ACCOUNT_LINE);

    const illustrationCenter = await contentCenterX(illustration);
    expect(
      Math.abs(illustrationCenter - centerX),
      "illustration centre vs. page centre",
    ).toBeLessThanOrEqual(1);

    const illustrationDrawn = await drawnContentBox(illustration);
    const lineBox = await createAccountLine.boundingBox();
    if (!lineBox) throw new Error("missing Créala line box");
    expect(
      illustrationDrawn.y,
      "illustration drawn content top at or below the Créala line's bottom",
    ).toBeGreaterThanOrEqual(lineBox.y + lineBox.height);
  });
});

// ENTRY-28: at 1440×900, /login's left block (the headline, the line and
// the illustration's drawn content) is centred as one group on the panel's
// vertical centre, in every state that changes the panel's height. The
// panel is the <form>'s own parent element. One assertion function for
// every state.
async function expectLeftBlockCentredOnPanel(page: Page, isDefaultState = false) {
  const headline = page.getByRole("heading", { level: 1 });
  const line = page.locator("p", { hasText: LOGIN_TAGLINE });
  const illustration = page.locator('img[src*="/illus/"]:visible');
  const footer = page.locator("footer");
  // The "Guárdalo" line: Headline.tsx renders the punchline as the h1's
  // second <span>.
  const guardaloLine = headline.locator("span").last();
  const orRow = page.getByText(OR_DIVIDER);
  const arrow = page.locator('svg[viewBox="0 0 280 140"]');

  await expect(headline).toBeVisible();
  await expect(line).toBeVisible();
  await expect(illustration).toBeVisible();
  await expect(arrow).toBeVisible();

  const headlineBox = await headline.boundingBox();
  const lineBox = await line.boundingBox();
  const illustrationBox = await illustration.boundingBox();
  if (!headlineBox || !lineBox || !illustrationBox) throw new Error("missing left-block box");

  // The illustration's drawn content is whole: the image keeps the file's
  // 3:2 proportions (Contracts › Illustrations), the same check
  // expectIllustrationUncropped makes on the image box.
  const ratio = illustrationBox.width / illustrationBox.height;
  expect(Math.abs(ratio - 1.5), "illustration width/height ratio vs. 1.5").toBeLessThanOrEqual(
    0.015,
  );

  const drawn = await drawnContentBox(illustration);

  const footerBox = await footer.boundingBox();
  if (!footerBox) throw new Error("missing footer box");
  expect(
    drawn.y + drawn.height,
    "the drawn content's bottom is above the footer's top",
  ).toBeLessThan(footerBox.y);

  // The union of the headline, the line and the drawn content boxes,
  // centred on the panel's vertical centre.
  const unionTop = Math.min(headlineBox.y, lineBox.y, drawn.y);
  const unionBottom = Math.max(
    headlineBox.y + headlineBox.height,
    lineBox.y + lineBox.height,
    drawn.y + drawn.height,
  );
  const unionCenterY = (unionTop + unionBottom) / 2;

  const panelBox = await loginPanelBox(page);
  const panelCenterY = panelBox.y + panelBox.height / 2;
  expect(
    Math.abs(unionCenterY - panelCenterY),
    "left block centre vs. panel centre",
  ).toBeLessThanOrEqual(2);

  // The arrow: its top lies within the "Guárdalo" line's box, and its tip
  // (the box's right edge) ends left of the panel, within 32px of its left
  // edge.
  const guardaloBox = await guardaloLine.boundingBox();
  const orRowBox = await orRow.boundingBox();
  const arrowBox = await arrow.boundingBox();
  if (!guardaloBox || !orRowBox || !arrowBox) throw new Error("missing arrow/Guárdalo/o-row box");
  expect(arrowBox.y, "arrow top at or after the Guárdalo line's top").toBeGreaterThanOrEqual(
    guardaloBox.y,
  );
  expect(arrowBox.y, "arrow top at or before the Guárdalo line's bottom").toBeLessThanOrEqual(
    guardaloBox.y + guardaloBox.height,
  );
  const arrowTipX = arrowBox.x + arrowBox.width;
  expect(arrowTipX, "arrow tip at or left of the panel's left edge").toBeLessThanOrEqual(
    panelBox.x,
  );
  expect(arrowTipX, "arrow tip within 32px of the panel's left edge").toBeGreaterThanOrEqual(
    panelBox.x - 32,
  );

  // Only in the default state: the tip (the path's end point, read from the
  // path itself because the arrowhead reaches below it) is at the height of
  // the "o" row (±8px).
  if (isDefaultState) {
    const tipY = await arrow
      .locator("path")
      .first()
      .evaluate((path: SVGPathElement) => {
        const end = path.getPointAtLength(path.getTotalLength());
        const matrix = path.getScreenCTM();
        if (!matrix) throw new Error("arrow path has no screen transform");
        return new DOMPoint(end.x, end.y).matrixTransform(matrix).y;
      });
    expect(tipY, "arrow tip at or after the o row's top (-8px)").toBeGreaterThanOrEqual(
      orRowBox.y - 8,
    );
    expect(tipY, "arrow tip at or before the o row's bottom (+8px)").toBeLessThanOrEqual(
      orRowBox.y + orRowBox.height + 8,
    );
  }
}

test.describe("ENTRY-28: at 1440×900, /login's left block is centred on the panel", () => {
  test("ENTRY-28: the default form", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login");
    await expectLeftBlockCentredOnPanel(page, true);
  });

  test("ENTRY-28: an empty submit (the per-field errors make the panel taller)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login");

    await page.getByRole("button", { name: SIGN_IN }).click();
    await expect(page.getByText(/el email es obligatorio|email is required/i)).toBeVisible();

    await expectLeftBlockCentredOnPanel(page);
  });

  test("ENTRY-28: an OAuth error (?error=account_not_linked)", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login?error=account_not_linked");

    await expect(page.getByRole("alert")).toBeVisible();

    await expectLeftBlockCentredOnPanel(page);
  });
});

// ENTRY-29: from 1024px wide, the illustration takes the room left for it
// (the item above, plus ENTRY-30's gap, down to what sits below), at the
// file's proportions, up to its per-page, per-breakpoint cap — and never
// makes the page scroll. Worked examples › "Room and the 150px minimum":
// at 1024×700 the room (213px) is under the cap so the illustration takes
// it whole; at 1024×760 the room (273px) is above the cap so the
// illustration sits at its cap, 480px wide.
test.describe("ENTRY-29: the illustration takes the room, up to its cap", () => {
  test("ENTRY-29: / at 1024×700, displayed, at least 150px of drawn height, at most 481px wide, no scroll", async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP_700);
    await page.goto("/");

    const illustration = page.locator('img[src*="/illus/"]:visible');
    await expect(illustration).toBeVisible();

    const drawn = await drawnContentBox(illustration);
    expect(drawn.height, "drawn content height at least 150px").toBeGreaterThanOrEqual(150);

    const box = await illustration.boundingBox();
    if (!box) throw new Error("illustration has no box");
    expect(box.width, "image width at most 481px").toBeLessThanOrEqual(481);

    const scrollMetrics = await scrollContainer(page).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollMetrics.scrollHeight, "the page does not scroll").toBeLessThanOrEqual(
      scrollMetrics.clientHeight + 1,
    );
  });

  test("ENTRY-29: / at 1024×760, the image is 480px wide at its cap, no scroll", async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP_760);
    await page.goto("/");

    const illustration = page.locator('img[src*="/illus/"]:visible');
    await expect(illustration).toBeVisible();

    const box = await illustration.boundingBox();
    if (!box) throw new Error("illustration has no box");
    expect(box.width, "image width 480px (±1px)").toBeGreaterThanOrEqual(479);
    expect(box.width, "image width 480px (±1px)").toBeLessThanOrEqual(481);

    const scrollMetrics = await scrollContainer(page).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollMetrics.scrollHeight, "the page does not scroll").toBeLessThanOrEqual(
      scrollMetrics.clientHeight + 1,
    );
  });

  test("ENTRY-29: at 1024×900, the image is at most 441px wide on /login and at most 481px on /", async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP_900);

    await page.goto("/");
    const landingBox = await page.locator('img[src*="/illus/"]:visible').boundingBox();
    if (!landingBox) throw new Error("/ illustration has no box");
    expect(landingBox.width, "/ image width at most 481px").toBeLessThanOrEqual(481);

    await page.goto("/login");
    const loginBox = await page.locator('img[src*="/illus/"]:visible').boundingBox();
    if (!loginBox) throw new Error("/login illustration has no box");
    expect(loginBox.width, "/login image width at most 441px").toBeLessThanOrEqual(441);
  });

  test("ENTRY-29: at 1440×900, the image is at most 621px wide on /login and at most 541px on /", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);

    await page.goto("/");
    const landingBox = await page.locator('img[src*="/illus/"]:visible').boundingBox();
    if (!landingBox) throw new Error("/ illustration has no box");
    expect(landingBox.width, "/ image width at most 541px").toBeLessThanOrEqual(541);

    await page.goto("/login");
    const loginBox = await page.locator('img[src*="/illus/"]:visible').boundingBox();
    if (!loginBox) throw new Error("/login illustration has no box");
    expect(loginBox.width, "/login image width at most 621px").toBeLessThanOrEqual(621);
  });
});

// ENTRY-30: the gap from the item above the illustration to its drawn
// content's top.
test.describe("ENTRY-30: the gap from the item above to the drawn content's top", () => {
  for (const viewport of [LAPTOP_900, LAPTOP_760, LAPTOP_700]) {
    test(`ENTRY-30: / at ${viewport.width}×${viewport.height}, 30px below Populares`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const populares = page.getByTestId("landing-popular");
      const illustration = page.locator('img[src*="/illus/"]:visible');
      await expect(illustration).toBeVisible();

      const popularesBox = await populares.boundingBox();
      if (!popularesBox) throw new Error("missing Populares box");
      const drawn = await drawnContentBox(illustration);

      expect(
        Math.abs(drawn.y - (popularesBox.y + popularesBox.height) - 30),
        "gap from Populares to the drawn content's top",
      ).toBeLessThanOrEqual(1);
    });
  }

  for (const viewport of [LAPTOP_900, PHONE_390]) {
    test(`ENTRY-30: /login at ${viewport.width}×${viewport.height}, 24px below Créala`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/login");

      const createAccountLine = page.getByText(NO_ACCOUNT_LINE);
      const illustration = page.locator('img[src*="/illus/"]:visible');
      await expect(illustration).toBeVisible();

      const lineBox = await createAccountLine.boundingBox();
      if (!lineBox) throw new Error("missing Créala line box");
      const drawn = await drawnContentBox(illustration);

      expect(
        Math.abs(drawn.y - (lineBox.y + lineBox.height) - 24),
        "gap from Créala to the drawn content's top",
      ).toBeLessThanOrEqual(1);
    });
  }

  test("ENTRY-30: /login at 1440×900, 30px below the tagline", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/login");

    const tagline = page.locator("p", { hasText: LOGIN_TAGLINE });
    const illustration = page.locator('img[src*="/illus/"]:visible');
    await expect(illustration).toBeVisible();

    const taglineBox = await tagline.boundingBox();
    if (!taglineBox) throw new Error("missing tagline box");
    const drawn = await drawnContentBox(illustration);

    expect(
      Math.abs(drawn.y - (taglineBox.y + taglineBox.height) - 30),
      "gap from the tagline to the drawn content's top",
    ).toBeLessThanOrEqual(1);
  });
});
