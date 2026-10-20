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
import { mockListingSources } from "./fixtures/network";
import { signIn, waitForSession } from "./fixtures/session";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/a11y-checks.md (Key A11Y, Approved). Keyboard walk-throughs of
// every redesigned screen, in a real browser (chromium): the skip link
// (A11Y-1, A11Y-2), the /map tab order at both widths (A11Y-3, A11Y-4), focus
// return from the openers jsdom cannot prove (A11Y-5), the DB-backed and the
// signed-out walk-throughs (A11Y-6, A11Y-7), and the map surface's own stop
// (A11Y-8). NONE of this is implemented yet (no skip link in app/layout.tsx,
// no role="application" name on the map surface — confirmed by reading both
// before writing this file), so every test below is expected to fail, on a
// missing skip link, a missing landmark or a missing/wrong accessible name —
// never on a syntax or fixture error. No implementation code is included in
// this change (CLAUDE.md: the brief is tests-only).
//
// Locale is forced to "es" throughout (setLocale, from e2e/maplibre.spec.ts),
// since the expected names below are the Spanish copy the boards specify;
// one English case (A11Y-1's "/" check) uses the "en" cookie instead.

const DESKTOP_1440 = { width: 1440, height: 900 };
const PHONE_390 = { width: 390, height: 844 };
const PASSWORD = "harbour-lentil-quilt-97";
const dbTest = process.env.E2E_DB ? test : test.skip;

/** Sets the `locale` cookie `lib/i18n/config.ts` reads, before any navigation (e2e/maplibre.spec.ts). */
async function setLocale(page: Page, locale: "en" | "es"): Promise<void> {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("setLocale needs the project's baseURL");
  await page.context().addCookies([{ name: "locale", value: locale, url: baseURL }]);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The currently focused element's tag and accessible name, computed the same
 * simplified way in every helper below (there is no accessible-name API in
 * the browser, so this is a hand-rolled approximation, not the full WAI-ARIA
 * algorithm): `aria-label` first, then `aria-labelledby` (joining the
 * referenced elements' text), then — for form controls — an associated
 * `<label>` or a `placeholder`, then an `<img>`'s `alt`, and otherwise the
 * element's own trimmed `textContent` (which already excludes nothing
 * `aria-hidden`, since `textContent` does not read inside it only when the
 * hidden node itself is skipped — handled explicitly below). Returns `null`
 * when nothing more specific than `<body>` is focused, the walk's end
 * signal. `devOverlay` marks a stop inside `next dev`'s own dev-tools overlay
 * (the `nextjs-portal` host the e2e server injects), which the app does not
 * render.
 */
async function focusedInfo(
  page: Page,
): Promise<{ tag: string; name: string; devOverlay: boolean } | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;

    function textOfChild(child: ChildNode): string {
      if (child.nodeType === Node.TEXT_NODE) return child.textContent ?? "";
      if (child.nodeType !== Node.ELEMENT_NODE) return "";
      const childEl = child as Element;
      if (childEl.getAttribute("aria-hidden") === "true") return "";
      return textExcludingHidden(childEl);
    }

    function textExcludingHidden(node: Element): string {
      return Array.from(node.childNodes).map(textOfChild).join("");
    }

    /** `aria-label`, else `aria-labelledby`'s referenced text — or `null` when neither is set. */
    function ariaNameOf(node: HTMLElement): string | null {
      const ariaLabel = node.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel.trim();

      const labelledBy = node.getAttribute("aria-labelledby");
      if (!labelledBy) return null;
      return labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ")
        .trim();
    }

    /** A `<label>` (by `for`, or the closest ancestor) or `placeholder` — or `null` off a non-form control. */
    function formControlNameOf(node: HTMLElement): string | null {
      const tag = node.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return null;

      const id = node.getAttribute("id");
      const labelledById = id ? document.querySelector(`label[for="${id}"]`) : null;
      if (labelledById?.textContent) return labelledById.textContent.trim();

      const closestLabel = node.closest("label");
      if (closestLabel?.textContent) return closestLabel.textContent.trim();

      return (node.getAttribute("placeholder") ?? "").trim();
    }

    function accessibleName(node: HTMLElement): string {
      const ariaName = ariaNameOf(node);
      if (ariaName !== null) return ariaName;

      const formControlName = formControlNameOf(node);
      if (formControlName !== null) return formControlName;

      if (node.tagName === "IMG") return (node.getAttribute("alt") ?? "").trim();

      return textExcludingHidden(node).trim().replace(/\s+/g, " ");
    }

    // `next dev`'s own dev-tools button (the «N» badge) lives in a shadow
    // root under a `nextjs-portal` host, which is what `activeElement`
    // reports while it is focused. It is not part of the app.
    const devOverlay = el.closest("nextjs-portal") !== null;
    return { tag: el.tagName, name: accessibleName(el), devOverlay };
  });
}

/** The walk's first focused element, kept on the page between key presses (tabWalk). */
interface TabWalkWindow extends Window {
  tabWalkFirst?: Element | null;
}

/**
 * From the current focus, presses Tab (or Shift+Tab when `reverse`)
 * repeatedly, recording each stop's `focusedInfo`. Stops when focus returns
 * to `<body>` (the walk's natural end) or the walk's first element is focused
 * again — a loop. The loop is told by the element itself, not by its tag and
 * name: two different stops can share a name (the not-found page's two
 * «Volver al mapa» links), and a name match would cut the walk short. A stop
 * inside `next dev`'s dev-tools overlay is passed over, unrecorded: it is not
 * part of the app. `maxStops` is a hard safety cap: a walk caught in a focus
 * trap can otherwise cycle forever, which would hang the test instead of
 * failing it.
 *
 * A walk that ends because focus left the page leaves nothing focused, so a
 * reverse walk started right after it re-enters at the last stop and records
 * it too: Shift+Tab after a forward walk visits the whole sequence reversed.
 */
async function tabWalk(
  page: Page,
  { reverse = false, maxStops = 80 }: { reverse?: boolean; maxStops?: number } = {},
): Promise<{ tag: string; name: string }[]> {
  const stops: { tag: string; name: string }[] = [];
  await page.evaluate(() => {
    (window as TabWalkWindow).tabWalkFirst = undefined;
  });

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
    const info = await focusedInfo(page);
    if (info === null) break;
    // Not the app's: `next dev`'s dev-tools button (focusedInfo's note).
    if (info.devOverlay) continue;
    const looped = await page.evaluate(() => {
      const walk = window as TabWalkWindow;
      if (walk.tabWalkFirst === undefined) {
        walk.tabWalkFirst = document.activeElement;
        return false;
      }
      return walk.tabWalkFirst === document.activeElement;
    });
    if (looped) break;
    stops.push({ tag: info.tag, name: info.name });
  }
  return stops;
}

/** Compares `stops`' names against `expected` (a literal string, or a RegExp for a dynamic name). */
function expectSequence(stops: { tag: string; name: string }[], expected: (string | RegExp)[]) {
  const actualNames = stops.map((stop) => stop.name);
  expect(actualNames.length, `stop count — got: ${JSON.stringify(actualNames)}`).toBe(
    expected.length,
  );
  for (let i = 0; i < expected.length; i++) {
    const pattern = expected[i];
    const actual = actualNames[i] ?? "";
    if (pattern instanceof RegExp) {
      expect(actual, `stop ${i + 1} of ${expected.length}`).toMatch(pattern);
    } else {
      expect(actual, `stop ${i + 1} of ${expected.length}`).toBe(pattern);
    }
  }
}

// LOOK-11's exact outline (e2e/foundation.spec.ts's own LOOK-11 test): solid,
// 2px, rgb(198, 255, 61), offset 3px. Duplicated here rather than imported —
// foundation.spec.ts does not export it, and this file's own header note on
// not coupling e2e spec files to save a few lines applies the same way
// e2e/alerts-ui.spec.ts's and e2e/map.spec.ts's duplicated `signIn` do.
const LOOK_11_OUTLINE = {
  outlineStyle: "solid",
  outlineWidth: "2px",
  outlineColor: "rgb(198, 255, 61)",
  outlineOffset: "3px",
};

/**
 * Asserts the currently focused element (A11Y-4): has a non-empty box inside
 * the viewport, is not clipped by a scrolling ancestor, is not covered by
 * another element at its own centre point, is not inside an `inert` or
 * `aria-hidden="true"` subtree, and draws its focus indicator
 * (expectFocusIndicator).
 */
async function expectVisibleFocus(page: Page) {
  const locator = page.locator(":focus");
  const focusedTag = await locator.evaluate((el) => el.tagName);
  expect(focusedTag, "nothing more specific than <body> is focused").not.toBe("BODY");

  const result = await locator.evaluate((el) => {
    /** True when `rect` sticks out past `node`'s box on any side, more than rounding. */
    function sticksOutOf(rect: DOMRect, node: Element): boolean {
      const ancestorRect = node.getBoundingClientRect();
      return (
        rect.top < ancestorRect.top - 0.5 ||
        rect.left < ancestorRect.left - 0.5 ||
        rect.bottom > ancestorRect.bottom + 0.5 ||
        rect.right > ancestorRect.right + 0.5
      );
    }

    /** The nearest scrolling ancestor whose box `rect` sticks out past, or `null`. */
    function clippingAncestor(rect: DOMRect): string | null {
      for (let node = el.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const scrolls =
          /(auto|scroll|hidden)/.test(style.overflowY) ||
          /(auto|scroll|hidden)/.test(style.overflowX);
        if (scrolls && sticksOutOf(rect, node)) {
          return node.tagName + (node.className ? `.${node.className}` : "");
        }
      }
      return null;
    }

    /** Whether some other element — not `el` and not inside or around it — sits at `rect`'s centre. */
    function isCoveredAtCentre(rect: DOMRect): boolean {
      const atPoint = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      if (atPoint === null) return true;
      return !(atPoint === el || el.contains(atPoint) || atPoint.contains(el));
    }

    /**
     * The map surface (A11Y-4, amended 2026-10-20): it counts as visible
     * when a part of it is uncovered, so this checks the centre of the part
     * ABOVE the phone's results sheet rather than the canvas's own centre
     * point. `rect` is first clipped to the viewport, then — only when the
     * sheet (`[data-testid="results-sheet"]`) overlaps it — to the strip
     * above the sheet's top edge.
     */
    function isMapSurfaceCovered(rect: DOMRect): boolean {
      const visibleLeft = Math.max(rect.left, 0);
      const visibleRight = Math.min(rect.right, window.innerWidth);
      const visibleTop = Math.max(rect.top, 0);
      let visibleBottom = Math.min(rect.bottom, window.innerHeight);

      const sheet = document.querySelector('[data-testid="results-sheet"]');
      if (sheet) {
        const sheetRect = sheet.getBoundingClientRect();
        const overlaps =
          sheetRect.top < visibleBottom &&
          sheetRect.bottom > visibleTop &&
          sheetRect.left < visibleRight &&
          sheetRect.right > visibleLeft;
        if (overlaps) visibleBottom = Math.min(visibleBottom, sheetRect.top);
      }

      const atPoint = document.elementFromPoint(
        (visibleLeft + visibleRight) / 2,
        (visibleTop + visibleBottom) / 2,
      );
      if (atPoint === null) return true;
      const container = el.closest("[data-map]");
      return !(atPoint === el || container?.contains(atPoint));
    }

    /** Whether `el` or an ancestor is `inert` or `aria-hidden="true"`. */
    function isInertOrHidden(): boolean {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if ((node as HTMLElement).inert || node.getAttribute("aria-hidden") === "true") return true;
      }
      return false;
    }

    const rect = el.getBoundingClientRect();
    const hasBox = rect.width > 0 && rect.height > 0;
    const insideViewport =
      rect.top >= -0.5 &&
      rect.left >= -0.5 &&
      rect.bottom <= window.innerHeight + 0.5 &&
      rect.right <= window.innerWidth + 0.5;
    const isMapSurface = el instanceof HTMLCanvasElement && el.closest("[data-map]") !== null;

    return {
      hasBox,
      insideViewport,
      clippedBy: clippingAncestor(rect),
      covered: isMapSurface ? isMapSurfaceCovered(rect) : isCoveredAtCentre(rect),
      inertOrHidden: isInertOrHidden(),
    };
  });

  expect(result.hasBox, "focused element has a non-empty box").toBe(true);
  expect(result.insideViewport, "focused element's box is inside the viewport").toBe(true);
  expect(result.clippedBy, "focused element is clipped by a scrolling ancestor").toBeNull();
  expect(result.covered, "focused element is covered at its own centre point").toBe(false);
  expect(result.inertOrHidden, "focused element is inside an inert/aria-hidden subtree").toBe(
    false,
  );
  await expectFocusIndicator(page);
}

/** Which focus indicator A11Y-4 reads for the focused element. */
type FocusIndicatorKind = "outline" | "card-photo-ring" | "map-ring";

/**
 * Asserts the focused element's indicator (A11Y-4, amended 2026-10-20): a
 * results card's link draws the photo's lime ring (MAPUI-66), read the way
 * e2e/map.spec.ts's MAPUI-66 test reads it; the map surface's canvas draws the
 * inset 2px lime ring on its map container (`[data-map]::after`); everything
 * else draws LOOK-11's outline.
 */
async function expectFocusIndicator(page: Page) {
  const locator = page.locator(":focus");
  const kind: FocusIndicatorKind = await locator.evaluate((el) => {
    if (el instanceof HTMLCanvasElement && el.closest("[data-map]")) return "map-ring";
    if (el.matches('[data-testid="results-sheet"] article a')) return "card-photo-ring";
    return "outline";
  });

  if (kind === "card-photo-ring") {
    // The ring's own box-shadow transition (CarCard.tsx's
    // transition-[box-shadow]) can still be mid-flight right after focus
    // lands, so this polls, as MAPUI-66 does.
    await expect
      .poll(
        () =>
          locator.evaluate((el) => {
            const photo = el.querySelector(":scope > div");
            return photo ? getComputedStyle(photo).boxShadow : "";
          }),
        { message: "the focused card link's photo does not draw MAPUI-66's lime ring" },
      )
      .toContain("rgb(198, 255, 61)");
    return;
  }

  if (kind === "map-ring") {
    const ring = await locator.evaluate((el) => {
      const container = el.closest("[data-map]");
      return container ? getComputedStyle(container, "::after").boxShadow : "";
    });
    expect(ring, "the map surface's container does not draw the inset lime ring").toBe(
      "rgb(198, 255, 61) 0px 0px 0px 2px inset",
    );
    return;
  }

  const outline = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
    };
  });
  // MapLibre's attribution toggle sits in the map's rounded corner, which
  // clips an outline drawn outside it, so its LOOK-11 outline is drawn inside
  // (A11Y-4, owner 2026-10-20): same style, width and colour, offset -2px.
  const isAttributionToggle = await locator.evaluate((el) =>
    el.matches(".maplibregl-ctrl-attrib-button"),
  );
  const expected = isAttributionToggle
    ? { ...LOOK_11_OUTLINE, outlineOffset: "-2px" }
    : LOOK_11_OUTLINE;
  expect(outline, "focused element does not draw LOOK-11's outline").toEqual(expected);
}

/** The "/favorites" link, visible once `useSession()` resolves (e2e/fixtures/session.ts). */
async function waitForHydration(page: Page) {
  await waitForSession(page);
}

// ---------------------------------------------------------------------------
// A11Y-1, A11Y-2: the skip link and the page's one `main` landmark
// ---------------------------------------------------------------------------

// Worked examples › Pages: every page this spec names, minus the two
// dev-only ones it excludes. The not-found page is reached by a path that
// resolves to no route. `/reset-password`, `/verify-email` and
// `/confirm-email` need a token query to reach their layout, not its
// validity (e2e/pages-access.spec.ts's own TOKEN, "e2e-layout-token").
const TOKEN = "e2e-layout-token";

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  `/reset-password?token=${TOKEN}`,
  `/verify-email?token=${TOKEN}`,
  `/confirm-email?token=${TOKEN}`,
  "/privacy",
  "/terms",
  "/esto-no-existe-de-verdad",
];

const DB_PAGES = ["/favorites", "/alerts", "/account"];

test.describe("A11Y-1: the skip link is the first Tab stop, hidden until focused, and Enter reaches main", () => {
  for (const path of PUBLIC_PAGES) {
    test(`A11Y-1: ${path} — first Tab focuses «Saltar al contenido», Enter moves focus into main`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await page.goto(path);

      const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
      // Not visible before it is focused: either no box, or off-screen. A
      // short timeout: the skip link does not exist yet, so without one
      // this would wait the full default actionability timeout on every
      // page in this loop.
      const beforeFocus = await skipLink.boundingBox({ timeout: 2000 }).catch(() => null);
      if (beforeFocus !== null) {
        expect(
          beforeFocus.x < 0 || beforeFocus.y < 0,
          "the skip link is drawn on-screen before it is focused",
        ).toBe(true);
      }

      await page.keyboard.press("Tab");
      await expect(skipLink).toBeFocused();
      await expectVisibleFocus(page);

      await page.keyboard.press("Enter");
      const insideMain = await page.evaluate(() => {
        const main = document.querySelector("main");
        return (
          main !== null &&
          (document.activeElement === main || main.contains(document.activeElement))
        );
      });
      expect(insideMain, "Enter on the skip link did not move focus into <main>").toBe(true);
    });
  }

  dbTest(
    "A11Y-1: /favorites, /alerts, /alerts/[id] and /account — first Tab focuses «Saltar al contenido», signed in",
    async ({ page }) => {
      const email = e2eEmail("a11y1-db");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [
        {
          label: "Alerta A11Y-1",
          criteria: { brand: "Toyota" },
          createdAt: new Date("2026-10-15T08:00:00Z"),
        },
      ]);
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await waitForHydration(page);

      for (const path of [...DB_PAGES, `/alerts/${alertId}`]) {
        await page.goto(path);
        const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
        await page.keyboard.press("Tab");
        await expect(skipLink, path).toBeFocused();
      }
    },
  );

  test("A11Y-1: / in English — first Tab focuses «Skip to content»", async ({ page }) => {
    await setLocale(page, "en");
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });
});

test.describe("A11Y-2: each page has exactly one main landmark, targeted by the skip link", () => {
  for (const path of PUBLIC_PAGES) {
    test(`A11Y-2: ${path} has exactly one main landmark, with an id the skip link's href targets`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.goto(path);

      const mains = page.getByRole("main");
      await expect(mains, `${path}: exactly one main landmark`).toHaveCount(1);
      const mainId = await mains.getAttribute("id");
      expect(mainId, `${path}: main has no id for the skip link to target`).not.toBeNull();

      const skipHref = await page
        .getByRole("link", { name: "Saltar al contenido" })
        .getAttribute("href");
      expect(skipHref, path).toBe(`#${mainId}`);
    });
  }
});

// ---------------------------------------------------------------------------
// A11Y-3, A11Y-4: the /map tab order, both widths, forward and reverse
// ---------------------------------------------------------------------------

// Worked examples › "Tab order on /map, signed out, default results". The
// default mock scenario returns exactly one listing per source — Audi
// (Wallapop, Madrid), BMW (coches.net, Barcelona), SEAT (Milanuncios,
// Seville) — e2e/fixtures/network.ts.
//
// Two names differ from the spec's own prose, hand-confirmed against the
// components rather than copied from the worked example's display labels:
//  - The search pill's segments (SearchPill.tsx): the segment's overline
//    label («Dónde», «Coche», «Precio») is `aria-hidden="true"`, so it is
//    never part of the button's accessible name — only its *value* is
//    (SearchPill.tsx's own header comment: "A segment's accessible name is
//    its value; its overline label describes it"). With nothing chosen, the
//    values (SearchPill.tsx: `where = placeLabel(place?.displayName, …)`,
//    which is `undefined` with no place selected, confirmed against
//    lib/search/filter-chips.test.ts's own "no location" case) are «Ciudad o
//    código postal…» (`search.wherePlaceholder`, the Segment's own fallback
//    — not «Toda España», which is `phone-summary.ts`'s fallback for the
//    *phone* summary button only), «Cualquier marca» and «Cualquiera».
//  - «ES»/«EN» (LanguageControl.tsx): each button's drawn text is "ES"/"EN",
//    but its `aria-label` is `t("nav.localeEs")`/`t("nav.localeEn")` —
//    "Español"/"Inglés" in messages/es.json — which is its accessible name.
const DESKTOP_MAP_SEQUENCE: (string | RegExp)[] = [
  "Saltar al contenido", // 1
  "BuyCarMap", // 2: the wordmark link
  "Ciudad o código postal…", // 3: «Dónde» segment — accessible name is its value, see header note
  "Cualquier marca", // 4: «Coche» segment
  "Cualquiera", // 5: «Precio» segment
  "Buscar", // 6
  "Crear alerta", // 7
  "Español", // 8: «ES» — accessible name is nav.localeEs, see header note
  "Inglés", // 9: «EN» — accessible name is nav.localeEn
  "Entrar", // 10
  "Filtros", // 11
  "Gasolina", // 12
  "Diésel", // 13
  "Manual", // 14
  "Automático", // 15
  /Hasta\s*100\.000\s*km/i, // 16
  /Audi A3 2\.0 TDI/, // 17: first card's link
  "Guardar", // 18: first card's heart, unsaved (signed out)
  /BMW Serie 3 320d/, // 19
  "Guardar", // 20
  /SEAT León 1\.5 TSI/, // 21
  "Guardar", // 22
  "Mapa: usa las flechas para moverlo y + o − para acercar o alejar", // 23: A11Y-8's name
  /Audi A3 2\.0 TDI/, // 24: first pin
  /BMW Serie 3 320d/, // 25
  /SEAT León 1\.5 TSI/, // 26
  "Acercar", // 27
  "Alejar", // 28
  "Mostrar u ocultar la atribución", // 29: the attribution's toggle
  /OpenFreeMap/, // 30
  /OpenMapTiles/, // 31
  /OpenStreetMap/, // 32
];

// Worked examples › phone sequence (amended 2026-10-20: "11–12. the link and
// the heart of the ONE card the sheet shows at its middle position
// (MAPUI-23)" — not every card the sheet holds, since the middle sheet
// position shows exactly one card; and the attribution toggle and its three
// links were added between the pins and the tab bar, matching the desktop
// list's own addition). The DOM order is the worked example's:
// MapResultsArea.tsx renders the phone band (PhoneSearchBar) first, then the
// ResultsSheet, then the map's <section> — the sheet before the map.
const PHONE_MAP_SEQUENCE: (string | RegExp)[] = [
  "Saltar al contenido", // 1: A11Y-1
  // 2: the search summary (PhoneSearchBar.tsx, the first <button>): its name is
  // its text, placeSummary over carPriceSummary (lib/search/phone-summary.ts):
  // «Toda España» (search.allSpain, no place) and «Cualquier marca · Cualquier
  // precio» (search.anyBrand, search.anyPrice); the two lines are separate
  // elements with no space between them in the DOM, hence the optional \s.
  /^Toda España\s*Cualquier marca · Cualquier precio$/,
  "Filtros", // 3: PhoneSearchBar.tsx «Filtros», aria-label map.filters
  "Gasolina", // 4: QuickFilters.tsx, filters.fuelGroups.gasoline
  "Diésel", // 5: filters.fuelGroups.gasoil
  "Manual", // 6: filters.transmissions.manual
  "Automático", // 7: filters.transmissions.automatic
  /Hasta\s*100\.000\s*km/i, // 8: filters.maxKmChip
  "Lista de resultados", // 9: ResultsSheet.tsx handle, aria-label map.sheetHandle
  "Crear alerta", // 10: ResultsSheet.tsx «Crear alerta», createAlert.open
  /Audi A3 2\.0 TDI/, // 11: the one card's link the middle sheet shows (CarCard.tsx)
  "Guardar", // 12: its heart, unsaved (CarCard.tsx HeartButton, map.addFavorite)
  "Mapa: usa las flechas para moverlo y + o − para acercar o alejar", // 13: the map surface, A11Y-8
  // Then the pins the sheet does not cover, and the attribution unless the
  // sheet covers it (A11Y-4 amended 2026-10-20: what the sheet covers is out
  // of the tab order). At 390×844 with the middle sheet, the sheet's top edge
  // rests 122px under the map's top, and the three default pins (fitted with
  // 40px of padding to the whole map) all sit lower, as does the attribution
  // at the map's bottom edge: none of them is a stop.
  "Mapa", // 14: the tab bar (TabBar.tsx), nav.map
  "Entrar", // 15: nav.signIn, signed out
];

test.describe("A11Y-3: /map's full tab order, signed out, default results", () => {
  test("A11Y-3: at 1440×900, Tab from the skip link visits exactly the desktop sequence, and Shift+Tab reverses it", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    // MapHeader.tsx draws «Entrar» once the session has resolved as signed
    // out (HEAD-11): the walk starts once it has.
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    const forward = await tabWalk(page);
    expectSequence(forward, DESKTOP_MAP_SEQUENCE);

    // The forward walk ends with focus off the page (tabWalk's note), so the
    // first Shift+Tab lands on the last stop and the walk goes back through
    // every stop to the skip link: the whole sequence, reversed.
    const backward = await tabWalk(page, { reverse: true });
    expectSequence(backward, [...DESKTOP_MAP_SEQUENCE].reverse());
  });

  // Worked examples (amended 2026-10-20, owner): the skip link skips the
  // whole header, the filters row included, which lives in the header.
  test("A11Y-3: after «Saltar al contenido» and Enter, the next Tab lands on the first card's link", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(
      page.getByTestId("results-sheet").locator("article").first().getByRole("link").first(),
    ).toBeFocused();
    await expect(page.locator(":focus")).toHaveAccessibleName(/Audi A3 2\.0 TDI/);
  });

  test("A11Y-3: at 390×844, Tab from the skip link visits exactly the phone sequence, and Shift+Tab reverses it", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(PHONE_390);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    // The tab bar (TabBar.tsx) draws «Entrar» once the session has resolved
    // as signed out (HEAD-11): the walk starts once it has.
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    const forward = await tabWalk(page);
    expectSequence(forward, PHONE_MAP_SEQUENCE);

    // The forward walk ends with focus off the page (tabWalk's note), so the
    // first Shift+Tab lands on the last stop and the walk goes back through
    // every stop to the skip link: the whole sequence, reversed.
    const backward = await tabWalk(page, { reverse: true });
    expectSequence(backward, [...PHONE_MAP_SEQUENCE].reverse());
  });
});

test.describe("A11Y-4: every Tab stop of the walk-throughs is visible, not clipped, not covered, not inert", () => {
  test("A11Y-4: /map at 1440×900 — every stop of the desktop walk is visible", async ({ page }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    // MapHeader.tsx draws «Entrar» once the session has resolved as signed
    // out (HEAD-11): the walk starts once it has.
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    for (let i = 0; i < DESKTOP_MAP_SEQUENCE.length; i++) {
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page);
    }
  });

  test("A11Y-4: /map at 390×844 — every stop of the phone walk is visible", async ({ page }) => {
    await setLocale(page, "es");
    await page.setViewportSize(PHONE_390);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    // The tab bar (TabBar.tsx) draws «Entrar» once the session has resolved
    // as signed out (HEAD-11): the walk starts once it has.
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    for (let i = 0; i < PHONE_MAP_SEQUENCE.length; i++) {
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page);
    }
  });

  // A11Y-7's signed-out pages, both widths, as the brief asks for A11Y-4's
  // own titled tests ("desktop and phone /map, plus the A11Y-7 pages").
  for (const path of PUBLIC_PAGES) {
    for (const viewport of [DESKTOP_1440, PHONE_390] as const) {
      test(`A11Y-4: ${path} at ${viewport.width}×${viewport.height} — every stop of the walk is visible`, async ({
        page,
      }) => {
        await setLocale(page, "es");
        await page.setViewportSize(viewport);
        await page.goto(path);
        // The headers draw placeholders until the session has resolved
        // (HEAD-11): both walks start once the page has settled.
        await page.waitForLoadState("networkidle");

        // Counts the stops first, then walks them again from a fresh
        // start — the skip link, the first Tab on a reloaded page — so that
        // every stop is reached by its own Tab press before it is checked.
        const stops = await tabWalk(page, { maxStops: 60 });
        expect(stops.length, `${path} has no focusable stops`).toBeGreaterThan(0);
        await page.reload();
        await page.waitForLoadState("networkidle");
        for (let i = 0; i < stops.length; i++) {
          await page.keyboard.press("Tab");
          let info = await focusedInfo(page);
          // Not the app's: `next dev`'s dev-tools button (tabWalk's note).
          if (info?.devOverlay) {
            await page.keyboard.press("Tab");
            info = await focusedInfo(page);
          }
          expect(info?.name, `stop ${i + 1} of ${stops.length}`).toBe(stops[i].name);
          await expectVisibleFocus(page);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// A11Y-5: Escape closes each opener at once, with focus back on its opener
// ---------------------------------------------------------------------------

test.describe("A11Y-5: Escape closes every opener at once, focus back on it, no animation", () => {
  test("A11Y-5: desktop — the Dónde, Coche and Precio popovers close on Escape with focus on their segment", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    // Default values (see the A11Y-3 header note): the «Dónde» segment's
    // fallback is its placeholder, not «Toda España» (that is the phone
    // summary's own fallback).
    for (const segmentName of [/ciudad o código postal/i, /cualquier marca/i, /cualquiera/i]) {
      const segment = page.getByRole("search").getByRole("button", { name: segmentName }).first();
      await segment.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("dialog").or(page.locator("[data-radix-popper-content-wrapper]")).first(),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      // Keyboard-instant (MOTION-10, A11Y-5 edge case): no animation frame to wait out.
      await expect(page.locator("[data-radix-popper-content-wrapper]")).toHaveCount(0);
      await expect(segment).toBeFocused();
    }
  });

  test("A11Y-5: desktop — the Filtros dropdown closes on Escape with focus on «Filtros»", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    const filtersButton = page.getByRole("button", { name: "Filtros" }).first();
    await filtersButton.focus();
    await page.keyboard.press("Enter");
    const dropdown = page.getByRole("dialog", { name: /^(filtros|filters)$/i });
    await expect(dropdown).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dropdown).toHaveCount(0);
    await expect(filtersButton).toBeFocused();
  });

  dbTest(
    "A11Y-5: desktop — the Crear alerta popover closes on Escape with focus on «Crear alerta»",
    async ({ page }) => {
      const email = e2eEmail("a11y5-crear-alerta");
      await seedUser(email, PASSWORD);
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await mockListingSources(page);
      await signIn(page, email, PASSWORD);
      await page.goto("/map");
      await waitForHydration(page);
      await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

      const crearAlerta = page
        .getByRole("button", { name: /^(crear alerta|create alert)$/i })
        .first();
      await crearAlerta.focus();
      await page.keyboard.press("Enter");
      const popover = page.getByRole("dialog", { name: /crear alerta|create alert/i });
      await expect(popover).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(popover).toHaveCount(0);
      await expect(crearAlerta).toBeFocused();
    },
  );

  test("A11Y-5: phone — the Filtros sheet closes on Escape with focus on «Filtros»", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(PHONE_390);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    const filtersButton = page.getByRole("button", { name: /^(filtros|filters)/i }).first();
    await filtersButton.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: /^(filtros|filters)$/i });
    await expect(sheet).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(filtersButton).toBeFocused();
  });

  dbTest(
    "A11Y-5: phone — the Crear alerta sheet closes on Escape with focus on «Crear alerta»",
    async ({ page }) => {
      const email = e2eEmail("a11y5-phone-crear-alerta");
      await seedUser(email, PASSWORD);
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await mockListingSources(page);
      await signIn(page, email, PASSWORD);
      await page.goto("/map");
      await waitForHydration(page);
      await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

      const crearAlerta = page
        .getByRole("button", { name: /^(crear alerta|create alert)$/i })
        .first();
      await crearAlerta.focus();
      await page.keyboard.press("Enter");
      const sheet = page.getByRole("dialog", { name: /crear alerta|create alert/i });
      await expect(sheet).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(crearAlerta).toBeFocused();
    },
  );
});

// ---------------------------------------------------------------------------
// A11Y-6: the DB-backed section pages, both widths
// ---------------------------------------------------------------------------

// Two saved cars (SAVED-28's own fixture shape) and two alerts, one with two
// matches (the brief's seed). Lat/lng are arbitrary but distinct so the maps
// involved never collapse two pins into one (MAP-15).
const FAV_1: SeedFavorite = {
  listingId: "a11y6-fav-1",
  title: "Favorito Uno",
  price: 10000,
  mileage: 50000,
  location: "Madrid",
  lat: 40.4168,
  lng: -3.7038,
  savedAt: new Date("2026-10-15T09:00:00Z"),
};
const FAV_2: SeedFavorite = {
  listingId: "a11y6-fav-2",
  title: "Favorito Dos",
  price: 12000,
  mileage: 60000,
  location: "Barcelona",
  lat: 41.3874,
  lng: 2.1686,
  savedAt: new Date("2026-10-15T09:05:00Z"),
};
const ALERT_WITH_MATCHES: SeedAlert = {
  label: "Alerta con coincidencias",
  criteria: { brand: "Toyota" },
  createdAt: new Date("2026-10-15T08:00:00Z"),
};
const ALERT_WITHOUT_MATCHES: SeedAlert = {
  label: "Alerta sin coincidencias",
  criteria: { brand: "Honda" },
  createdAt: new Date("2026-10-15T07:00:00Z"),
};
const MATCH_1: SeedAlertMatch = {
  listingId: "a11y6-match-1",
  title: "Coincidencia Uno",
  price: 11000,
  mileage: 40000,
  location: "Madrid",
  lat: 40.4168,
  lng: -3.7038,
  createdAt: new Date("2026-10-15T09:00:00Z"),
};
const MATCH_2: SeedAlertMatch = {
  listingId: "a11y6-match-2",
  title: "Coincidencia Dos",
  price: 13000,
  mileage: 45000,
  location: "Valencia",
  lat: 39.4699,
  lng: -0.3763,
  createdAt: new Date("2026-10-15T09:05:00Z"),
};

interface A11y6Fixture {
  email: string;
  alertWithMatchesId: string;
}

async function seedA11y6(tag: string): Promise<A11y6Fixture> {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  await seedFavorites(email, [FAV_1, FAV_2]);
  const [alertWithMatchesId] = await seedAlerts(email, [ALERT_WITH_MATCHES, ALERT_WITHOUT_MATCHES]);
  await seedAlertMatches(alertWithMatchesId, [MATCH_1, MATCH_2]);
  return { email, alertWithMatchesId };
}

// Desktop chrome shared by every signed-in section page (PagesHeader.tsx,
// HeaderParts.tsx): wordmark, Español, Inglés (see the A11Y-3 header note),
// Mapa · Guardados · Alertas (nav-routes.ts's SECTIONS order), and the
// avatar, named «Cuenta» (Avatar.tsx's aria-label is t("nav.account")).
const DESKTOP_CHROME_PREFIX: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Mapa",
  "Guardados",
  "Alertas",
  "Cuenta",
];

// Phone chrome on the signed-in section pages (PagesHeader.tsx's PhoneRegion):
// only the wordmark and the language control — no avatar, since «Cuenta»
// lives in the tab bar instead (the file's own header comment, confirmed by
// PagesHeader.tsx: the phone MainNav renders nothing for `signedIn`).
const PHONE_CHROME_PREFIX: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
];

// The phone tab bar on every signed-in section page (TabBar.tsx): Mapa,
// Guardados, Alertas, Cuenta (its icon is aria-hidden, so the stop's name is
// the TabLink's own visible label text).
const PHONE_TAB_BAR: (string | RegExp)[] = ["Mapa", "Guardados", "Alertas", "Cuenta"];

// SAVED-13: /favorites' own map ("Mapa de tus guardados") follows the list,
// with the same pins/attribution/zoom tab stops the main map page has
// (A11Y-8 does not cover this map — only `/map`'s). Hand-confirmed against a
// real run of this file (reported verbatim): after the cards, one stop with
// an empty accessible name (most likely MapLibre's own canvas container,
// focusable before a pin's button is portaled in — not pinned down further),
// then the pins (same "Recientes" order as the cards), the attribution
// toggle «Mostrar u ocultar la atribución», the three attribution links («©
// OpenMapTiles» carries a copyright glyph the others don't), «Acercar»,
// «Alejar». The second empty-named stop that run also reported after «Alejar»
// was `next dev`'s dev-tools button (a `nextjs-portal` host), which tabWalk
// now passes over: it is not part of the app. Reused by every A11Y-6 test
// whose page carries a listings/zone map (favorites, the open alert).
function mapRegionTail(pinNames: (string | RegExp)[]): (string | RegExp)[] {
  // The same map tail as /map's worked example (A11Y-3): the named map
  // surface (A11Y-8), the pins, the zoom buttons, then the attribution.
  return [
    "Mapa: usa las flechas para moverlo y + o − para acercar o alejar",
    ...pinNames,
    "Acercar",
    "Alejar",
    "Mostrar u ocultar la atribución",
    "OpenFreeMap",
    /OpenMapTiles/,
    "OpenStreetMap",
  ];
}

test.describe("A11Y-6: /favorites, /alerts, /alerts/[id] and /account walk from the skip link to the end and back", () => {
  dbTest(
    "A11Y-6: /favorites at 1440×900 — skip link, header, sort chips, each card's link and heart, then the map (SAVED-6, SAVED-28, SAVED-13)",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-fav-desktop");
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await page.goto("/favorites");
      await waitForHydration(page);
      await expect(page.getByText("Favorito Uno")).toBeVisible();

      // SAVED-6: the three sort chips, «Recientes» pressed by default —
      // newest saved first, so «Favorito Dos» (saved 09:05) leads «Favorito
      // Uno» (saved 09:00): hand-confirmed against a real run of this file.
      const expected: (string | RegExp)[] = [
        ...DESKTOP_CHROME_PREFIX,
        "Recientes",
        "Precio",
        "Km",
        /Favorito Dos/,
        "Quitar de guardados",
        /Favorito Uno/,
        "Quitar de guardados",
        ...mapRegionTail([/Favorito Dos/, /Favorito Uno/]),
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /favorites at 390×844 — skip link, phone header, then each row, then the tab bar (SAVED-2)",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-fav-phone");
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);
      await page.goto("/favorites");
      await waitForHydration(page);
      await expect(page.getByText("Favorito Uno")).toBeVisible();

      // SAVED-2: phone width shows no sort chips and no map — just the
      // rows, newest saved first (see the desktop test's own note).
      const expected: (string | RegExp)[] = [
        ...PHONE_CHROME_PREFIX,
        /Favorito Dos/,
        /Favorito Uno/,
        ...PHONE_TAB_BAR,
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /alerts at 1440×900 — skip link, header, «Nueva alerta», then the open alert's matches (ALERTUI-54)",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-alerts-desktop");
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await page.goto("/alerts");
      await waitForHydration(page);
      await expect(page.getByText("Coincidencia Uno")).toBeVisible();
      // AlertMap loads MapLibre on its own (a dynamic import, then the
      // style): its pins are the last of it to appear, and the walk below
      // must not start before the map region has its stops.
      await expect(page.getByRole("button", { name: /^Coincidencia Uno, / })).toBeVisible();

      // Read from the component tree with this file's seed (seedA11y6): two
      // alerts, newest first by createdAt (ALERTUI-1; server/alerts/service.ts
      // NEWEST_FIRST) — «Alerta con coincidencias» (08:00) open, as the newest
      // with no `alert` in the URL (ALERTUI-12), «Alerta sin coincidencias»
      // (07:00) folded.
      const expected: (string | RegExp)[] = [
        ...DESKTOP_CHROME_PREFIX,
        // AlertsHeading.tsx: «Nueva alerta», the link on the heading's row,
        // alerts.newAlert (ALERTUI-1). The h1 is tabIndex -1 only, not a stop.
        "Nueva alerta",
        // AlertCard.tsx OpenAlertCard: the <article> is tabIndex -1
        // (ALERTUI-57), not a stop. Its matches (ALERTUI-7), newest first
        // (MATCH_2 09:05, then MATCH_1 09:00): each AlertMatchCard is one link
        // and has no heart (ALERTUI-8). Two matches, so no «Ver las N
        // coincidencias» (ALERTUI-7: only above four).
        /Coincidencia Dos/,
        /Coincidencia Uno/,
        // OpenAlertCard's «Eliminar» button, on the «Creada el …» row,
        // alerts.deleteShort (ALERTUI-7, ALERTUI-33).
        "Eliminar",
        // AlertCard.tsx FoldedAlertCard: one button named by the alert's name
        // through aria-labelledby (ALERTUI-6, ALERTUI-11).
        "Alerta sin coincidencias",
        // AlertsPage.tsx renders AlertMap after the list column: ListingsMap's
        // canvas, one pin per match in the cards' order, attribution and zoom
        // (ALERTUI-1, ALERTUI-14 to ALERTUI-17). The alert has no place, so no
        // zone (ALERTUI-14) — nothing focusable in it either way.
        ...mapRegionTail([/Coincidencia Dos/, /Coincidencia Uno/]),
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /alerts at 390×844 — skip link, phone header, one link per alert, then the tab bar (ALERTUI-2, ALERTUI-13, ALERTUI-28)",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-alerts-phone");
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);
      await page.goto("/alerts");
      await waitForHydration(page);
      await expect(page.getByText("Alerta sin coincidencias")).toBeVisible();

      // ALERTUI-2: the phone header with no «Volver» (PagesHeader.tsx: no
      // `back` off an alert's page), the heading alone (AlertsHeading.tsx
      // drops «Nueva alerta» with `phone`), the alerts newest first as phone
      // AlertCards, no map and no «Eliminar», then the tab bar.
      const expected: (string | RegExp)[] = [
        ...PHONE_CHROME_PREFIX,
        // AlertCard.tsx PhoneAlertCard: one link per alert to its page, named
        // by the alert's name through aria-labelledby (ALERTUI-28), whatever
        // the URL's `alert` says (ALERTUI-13). Newest first: 08:00, then 07:00.
        "Alerta con coincidencias",
        "Alerta sin coincidencias",
        ...PHONE_TAB_BAR,
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /alerts/[id] at 1440×900 — Tab from «Volver» through each match's link and heart, then «Eliminar alerta», then the map (ALERTUI-54)",
    async ({ page }) => {
      const { email, alertWithMatchesId } = await seedA11y6("a11y6-alert-detail-desktop");
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await page.goto(`/alerts/${alertWithMatchesId}`);
      await waitForHydration(page);
      await expect(page.getByText("Coincidencia Uno")).toBeVisible();

      // Hand-confirmed against a real run of this file: «Eliminar alerta»
      // sits right after the cards, in DOM/tab order *before* the map
      // region (its pins, attribution and zoom buttons) — not at the very
      // end, which an earlier reading of ALERTUI-54 had assumed.
      const expected: (string | RegExp)[] = [
        ...DESKTOP_CHROME_PREFIX,
        "Volver",
        /Coincidencia Dos/,
        "Guardar",
        /Coincidencia Uno/,
        "Guardar",
        /eliminar alerta/i,
        ...mapRegionTail([/Coincidencia Dos/, /Coincidencia Uno/]),
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /alerts/[id] at 390×844 — «Volver» is the phone header's own item, then each match, then «Eliminar alerta» (ALERTUI-31, HEAD-7)",
    async ({ page }) => {
      const { email, alertWithMatchesId } = await seedA11y6("a11y6-alert-detail-phone");
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);
      await page.goto(`/alerts/${alertWithMatchesId}`);
      await waitForHydration(page);
      await expect(page.getByText("Coincidencia Uno")).toBeVisible();

      // HEAD-7 (amended, ALERTUI-22): at phone width «Volver» is the
      // header's own back link, before the wordmark, in place of the
      // section pages' plain wordmark-only phone header. Newest match first
      // (see the desktop test's own note) — «Coincidencia Dos» before «Uno».
      // This fixture's alert has no place/zone, so no phone zone preview
      // (and so no map tail) is expected here.
      const expected: (string | RegExp)[] = [
        "Saltar al contenido",
        "Volver",
        "BuyCarMap",
        "Español",
        "Inglés",
        /Coincidencia Dos/,
        /Coincidencia Uno/,
        /eliminar alerta/i,
        ...PHONE_TAB_BAR,
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /account at 1440×900 — «Cerrar sesión» on the heading row, then each card's own controls in PAGES-25's order",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-account-desktop");
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await signIn(page, email, PASSWORD);
      await page.goto("/account");
      await waitForHydration(page);
      // The page's own h1 ("Cuenta", exact — a loose match also catches the
      // "Eliminar cuenta" card's h2, confirmed by a real run of this file)
      // and the own card's "Cambiar nombre": the account's cards render
      // asynchronously, and without waiting for one of their own buttons the
      // walk below can start while the page is still its own loading
      // skeleton (confirmed by a real run of this file).
      await expect(page.getByRole("heading", { name: "Cuenta", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cambiar nombre" })).toBeVisible();

      // PAGES-25's card order: own, Correo, Contraseña, Dos pasos, Google,
      // Sesiones, Tus datos, Eliminar cuenta. The seeded account has a
      // password and no Google link and 2FA off, so every card but Google
      // shows a button; Google shows none ("No hay cuentas conectadas.").
      // The «Correo» card's exact button depends on whether the seeded
      // address reads as confirmed — seedUser (e2e/fixtures/db.ts) never
      // sets `email_confirmed`, assumed false/unconfirmed here — **flagged
      // in the report as unconfirmed against the column's actual default.**
      const expected: (string | RegExp)[] = [
        ...DESKTOP_CHROME_PREFIX,
        /cerrar sesión/i,
        "Cambiar nombre",
        /enviar correo de verificación/i,
        "Cambiar correo",
        "Cambiar contraseña",
        "Activar",
        /cerrar las demás/i,
        /descargar mis datos/i,
        /eliminar mi cuenta/i,
      ];
      await expectWalkBothWays(page, expected);
    },
  );

  dbTest(
    "A11Y-6: /account at 390×844 — the phone header and tab bar, «Cerrar sesión» after the last card (PAGES-26)",
    async ({ page }) => {
      const { email } = await seedA11y6("a11y6-account-phone");
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);
      await page.goto("/account");
      await waitForHydration(page);
      // See the desktop test's own note on why both waits are needed.
      await expect(page.getByRole("heading", { name: "Cuenta", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cambiar nombre" })).toBeVisible();

      const expected: (string | RegExp)[] = [
        ...PHONE_CHROME_PREFIX,
        "Cambiar nombre",
        /enviar correo de verificación/i,
        "Cambiar correo",
        "Cambiar contraseña",
        "Activar",
        /cerrar las demás/i,
        /descargar mis datos/i,
        /eliminar mi cuenta/i,
        /cerrar sesión/i,
        ...PHONE_TAB_BAR,
      ];
      await expectWalkBothWays(page, expected);
    },
  );
});

// ---------------------------------------------------------------------------
// A11Y-7: the signed-out pages, both widths
// ---------------------------------------------------------------------------

// Every sequence below is read from the components and messages/es.json, not
// copied from a run. What every page shares:
//  - «Saltar al contenido» first (A11Y-1).
//  - The wordmark (Wordmark.tsx, «BuyCarMap»: the upper case is CSS) and the
//    language control (LanguageControl.tsx: «ES»/«EN» named nav.localeEs
//    «Español» / nav.localeEn «Inglés», see the A11Y-3 header note). Each
//    header draws a desktop and a phone region; CSS shows one
//    (HeaderParts.tsx DesktopRegion `hidden lg:flex`, PhoneRegion
//    `lg:hidden`), so only that one's controls are stops.
//  - From `md` the footer (Footer.tsx, `hidden md:flex`): «Privacidad»
//    (footer.privacy), «Términos» (footer.terms) and the «Storyset» link
//    inside «Ilustraciones de Storyset». Not drawn at 390px.
//  - No tab bar: signed out, it shows on /map only (nav-routes.ts showsTabBar).

// AccessHeader.tsx (HEAD-6, HEAD-7), the header of /login, /register,
// /forgot-password, the legal pages and the signed-out not-found page
// (SiteHeader.tsx, PAGES-66). Desktop: «Volver al mapa» (nav.backToMap).
// Phone: «Mapa» (nav.map), or «Volver» (nav.back) on the legal pages.
const ACCESS_DESKTOP_CHROME: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Volver al mapa",
];
const ACCESS_PHONE_CHROME_MAP: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Mapa",
];
const ACCESS_PHONE_CHROME_BACK: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Volver",
];
const FOOTER: (string | RegExp)[] = ["Privacidad", "Términos", "Storyset"];

// LoginForm.tsx inside AccessPanel (ENTRY-9 to ENTRY-13), the same at both
// widths: the «Email» input (its <label for="email">, auth.email), «¿La
// olvidaste?» (the link beside the password label, auth.forgotPassword), the
// «Contraseña» input (auth.password), PasswordInput.tsx's eye button
// («Mostrar contraseña», password.show), «Entrar» (the BusyButton,
// auth.signIn), OAuthButtons.tsx's «Continuar con Google»
// (GoogleSignInButton.tsx, auth.continueWithGoogle — playwright.config.ts
// configures Google for the e2e server) and «Créala» (auth.createOne). No
// two-factor field until a sign-in asks for it (ENTRY-13).
const LOGIN_FORM: (string | RegExp)[] = [
  "Email",
  "¿La olvidaste?",
  "Contraseña",
  "Mostrar contraseña",
  "Entrar",
  "Continuar con Google",
  "Créala",
];

// RegisterForm.tsx inside AccessPanel (PAGES-7 to PAGES-12): «Email»,
// «Contraseña» and its eye button, «Repite la contraseña»
// (auth.confirmPassword) and its eye button, «Crear cuenta» (auth.signUp),
// «Continuar con Google», then the consent line's «Términos» and «Privacidad»
// links (auth.legalNotice, in that order, PAGES-9) and «Entra»
// (auth.signInLink). PasswordStrengthMeter.tsx has nothing focusable.
const REGISTER_FORM: (string | RegExp)[] = [
  "Email",
  "Contraseña",
  "Mostrar contraseña",
  "Repite la contraseña",
  "Mostrar contraseña",
  "Crear cuenta",
  "Continuar con Google",
  "Términos",
  "Privacidad",
  "Entra",
];

// ForgotPasswordForm.tsx inside AccessPanel (PAGES-20, PAGES-21): «Email»,
// «Enviar enlace» (forgotPassword.submit), «Volver a entrar» (AccessLink,
// forgotPassword.backToLogin).
const FORGOT_FORM: (string | RegExp)[] = ["Email", "Enviar enlace", "Volver a entrar"];

// LegalToc.tsx (PAGES-62, PAGES-63, MOTION-15): from `lg`, the index's one
// link per section, in the message file's order (legal.<doc>.sections[].
// heading); the phone toggle «En esta página» (legal.onThisPage) is
// `lg:hidden`. On a phone only that toggle: the list is not rendered while
// folded (useLegalToc: showList = !isPhone || open). LegalContent.tsx has no
// other control.
const PRIVACY_TOC: (string | RegExp)[] = [
  "Información que recopilamos",
  "Cómo usamos tus datos",
  "Ubicación",
  "Cookies",
  "Servicios de terceros",
  "Conservación de datos",
  "Tus derechos",
  "Contacto",
];
const TERMS_TOC: (string | RegExp)[] = [
  "Sobre el servicio",
  "Tu cuenta",
  "Uso aceptable",
  "Anuncios de terceros",
  "Sin garantías",
  "Limitación de responsabilidad",
  "Cambios en los términos",
  "Contacto",
];

const A11Y7_SEQUENCES: Record<
  string,
  { desktop: (string | RegExp)[]; phone: (string | RegExp)[] }
> = {
  "/login": {
    desktop: [...ACCESS_DESKTOP_CHROME, ...LOGIN_FORM, ...FOOTER],
    phone: [...ACCESS_PHONE_CHROME_MAP, ...LOGIN_FORM],
  },
  "/register": {
    desktop: [...ACCESS_DESKTOP_CHROME, ...REGISTER_FORM, ...FOOTER],
    phone: [...ACCESS_PHONE_CHROME_MAP, ...REGISTER_FORM],
  },
  "/forgot-password": {
    desktop: [...ACCESS_DESKTOP_CHROME, ...FORGOT_FORM, ...FOOTER],
    phone: [...ACCESS_PHONE_CHROME_MAP, ...FORGOT_FORM],
  },
  "/privacy": {
    desktop: [...ACCESS_DESKTOP_CHROME, ...PRIVACY_TOC, ...FOOTER],
    phone: [...ACCESS_PHONE_CHROME_BACK, "En esta página"],
  },
  "/terms": {
    desktop: [...ACCESS_DESKTOP_CHROME, ...TERMS_TOC, ...FOOTER],
    phone: [...ACCESS_PHONE_CHROME_BACK, "En esta página"],
  },
  // app/not-found.tsx (PAGES-65, PAGES-66): signed out, the access header
  // (desktop «Volver al mapa», phone «Mapa»), then EmptyState's one action,
  // «Volver al mapa» (nav.backToMap), inside PageStateLayout.tsx, whose
  // empty map beside it is aria-hidden with nothing focusable. No footer.
  "/esto-no-existe-de-verdad": {
    desktop: [...ACCESS_DESKTOP_CHROME, "Volver al mapa"],
    phone: [...ACCESS_PHONE_CHROME_MAP, "Volver al mapa"],
  },
};

// The landing, signed out (app/page.tsx, ENTRY-1 to ENTRY-8). LandingHeader.tsx
// (HEAD-5, HEAD-7): desktop «Entrar» (TextLink, nav.signIn) and «Crear cuenta»
// (nav.createAccount); phone «Entrar» (PhoneTextLink) alone.
//
// Desktop, 1440×900 (`3xl` is 90rem, app/globals.css, so the 1440 grid):
// LandingSearch.tsx's pill (SearchPill `variant="landing"`): each segment's
// name is its value (see the A11Y-3 header note) — «Ciudad o código postal…»
// (search.wherePlaceholder), «Marca o modelo…» (search.carPlaceholder, the
// landing's own «Coche» placeholder), «Cualquiera» (search.priceAny) — then
// «Buscar», whose name is its drawn label (search.submit; the landing variant
// sets no aria-label). Then Landing.tsx's «Populares» links in POPULAR_CARS
// order, the desktop map preview (MapPreview.tsx, one link named
// hero.exploreMap «Ver el mapa», shown from `3xl`), and the footer
// (app/page.tsx renders it after main). The illustration slot and the art
// layer are aria-hidden with nothing focusable.
const LANDING_DESKTOP: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Entrar",
  "Crear cuenta",
  "Ciudad o código postal…",
  "Marca o modelo…",
  "Cualquiera",
  "Buscar",
  "Golf",
  "SEAT León",
  "BMW Serie 3",
  "Audi A4",
  "Ver el mapa",
  ...FOOTER,
];
// Phone, 390×844: the header, LandingSearch.tsx's phone card (one button,
// aria-label search.sheetTitle «BUSCAR»; the desktop pill is `hidden lg:flex`)
// and the phone map preview (MapPreview.tsx, «Ver el mapa»). The popular cars
// and the desktop preview are in `landing-desktop`, `hidden lg:contents`.
const LANDING_PHONE: (string | RegExp)[] = [
  "Saltar al contenido",
  "BuyCarMap",
  "Español",
  "Inglés",
  "Entrar",
  "BUSCAR",
  "Ver el mapa",
];

/** Walks forward from a fresh page and back (tabWalk's note: the whole sequence, reversed). */
async function expectWalkBothWays(page: Page, expected: (string | RegExp)[], maxStops = 60) {
  const forward = await tabWalk(page, { maxStops });
  expectSequence(forward, expected);
  const backward = await tabWalk(page, { reverse: true, maxStops });
  expectSequence(backward, [...expected].reverse());
}

test.describe("A11Y-7: the signed-out pages walk from the skip link to the end and back", () => {
  const dbFreePages = ["/login", "/register", "/forgot-password"];

  for (const path of dbFreePages) {
    test(`A11Y-7: ${path} at 1440×900 — the access header's chrome leads the walk, Shift+Tab reverses it`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await page.goto(path);

      await expectWalkBothWays(page, A11Y7_SEQUENCES[path].desktop);
    });

    test(`A11Y-7: ${path} at 390×844 — the phone access header's chrome («Mapa») leads the walk`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await page.goto(path);

      await expectWalkBothWays(page, A11Y7_SEQUENCES[path].phone);
    });
  }

  test("A11Y-7: / (landing, signed out) at 1440×900 and 390×844 — walks from the skip link", async ({
    page,
  }) => {
    for (const [viewport, expected] of [
      [DESKTOP_1440, LANDING_DESKTOP],
      [PHONE_390, LANDING_PHONE],
    ] as const) {
      await setLocale(page, "es");
      await page.setViewportSize(viewport);
      await page.goto("/");
      // LandingHeader.tsx draws placeholders, not «Entrar», until the
      // session has resolved (HEAD-11): the walk starts once it has.
      await expect(
        page.getByRole("link", { name: "Entrar", exact: true }).filter({ visible: true }),
      ).toBeVisible();

      await expectWalkBothWays(page, [...expected]);
    }
  });

  for (const path of ["/privacy", "/terms"]) {
    test(`A11Y-7: ${path} at 1440×900 — the access header's chrome («Volver al mapa») leads the walk (PAGES-68, MOTION-15)`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.setViewportSize(DESKTOP_1440);
      await page.goto(path);

      await expectWalkBothWays(page, A11Y7_SEQUENCES[path].desktop);
    });

    test(`A11Y-7: ${path} at 390×844 — the phone legal header's chrome («Volver») leads the walk`, async ({
      page,
    }) => {
      await setLocale(page, "es");
      await page.setViewportSize(PHONE_390);
      await page.goto(path);

      await expectWalkBothWays(page, A11Y7_SEQUENCES[path].phone);
    });
  }

  test("A11Y-7: the not-found page at 1440×900 and 390×844, signed out — the access header's chrome leads the walk (PAGES-66)", async ({
    page,
  }) => {
    const path = "/esto-no-existe-de-verdad";
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await page.goto(path);
    // SiteHeader.tsx: while the session resolves, the not-found page draws
    // the landing's placeholder header, and the access header only once it
    // is signed out (PAGES-66, HEAD-11): the walk starts once it is.
    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "Volver al mapa", exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expectWalkBothWays(page, A11Y7_SEQUENCES[path].desktop);

    // PAGES-66: signed out, the not-found page's phone header reads «Mapa»,
    // like the sign-in pages' — not «Volver», which is the legal pages' own.
    await setLocale(page, "es");
    await page.setViewportSize(PHONE_390);
    await page.goto(path);
    await expect(
      header.getByRole("link", { name: "Mapa", exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expectWalkBothWays(page, A11Y7_SEQUENCES[path].phone);
  });
});

// ---------------------------------------------------------------------------
// A11Y-8: the map surface's own tab stop
// ---------------------------------------------------------------------------

test.describe("A11Y-8: the map surface is a single named, operable tab stop; the phone zone preview is not", () => {
  test("A11Y-8: desktop — the map surface is role=application, named «Mapa: usa las flechas...», and an arrow key/+ operate it", async ({
    page,
  }) => {
    await setLocale(page, "es");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    const mapEl = page.locator('[data-map="listings"]');
    const surface = mapEl.getByRole("application", {
      name: "Mapa: usa las flechas para moverlo y + o − para acercar o alejar",
    });
    // Short timeout: this role/name does not exist yet (A11Y-8 is new), so
    // without one this would wait the full default actionability timeout.
    await surface.focus({ timeout: 3000 });
    await expect(surface).toBeFocused();

    const centreBefore = await mapEl.getAttribute("data-map-center");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => mapEl.getAttribute("data-map-center")).not.toBe(centreBefore);

    const zoomBefore = Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN);
    await page.keyboard.press("+");
    await expect
      .poll(async () => Number((await mapEl.getAttribute("data-map-zoom")) ?? Number.NaN))
      .toBe(zoomBefore + 1);
  });

  test("A11Y-8: English locale — the map surface is named «Map: use the arrow keys...»", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await page.setViewportSize(DESKTOP_1440);
    await mockListingSources(page);
    await page.goto("/map");

    const mapEl = page.locator('[data-map="listings"]');
    await expect(
      mapEl.getByRole("application", {
        name: "Map: use the arrow keys to move it and + or − to zoom",
      }),
    ).toBeVisible();
  });

  dbTest(
    "A11Y-8: phone — the alert's zone preview has nothing in the tab order",
    async ({ page }) => {
      const email = e2eEmail("a11y8-zone");
      await seedUser(email, PASSWORD);
      const [alertId] = await seedAlerts(email, [
        {
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
        },
      ]);
      await setLocale(page, "es");
      await stubMapTiles(page);
      await mockListingSources(page);
      await page.setViewportSize(PHONE_390);
      await signIn(page, email, PASSWORD);

      await page.goto(`/alerts/${alertId}`);
      await waitForHydration(page);

      const zone = page.locator('[data-map="zone"]');
      await expect(zone).toBeVisible();
      const focusableInZone = await zone
        .locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        .count();
      expect(focusableInZone, "the zone preview has a focusable element").toBe(0);
    },
  );
});
