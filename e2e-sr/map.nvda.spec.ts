// docs/specs/a11y-checks.md (A11Y-9 to A11Y-13, A11Y-14). This file runs only
// through its own Playwright config (playwright.sr.config.ts, A11Y-14) and its
// own `pnpm test:sr` script — never through `pnpm test:e2e` or
// `pnpm check:full` (Decisions and rationale › "Outside check:full": Guidepup
// forces serial, headed runs and needs a real NVDA on the machine, so folding
// it into the local contract would make every local check depend on NVDA).
// It needs NVDA on a Windows machine (Guidepup's own requirement), so it does
// not run locally: its runner is .github/workflows/screen-reader.yml
// (windows-2025, NVDA installed by @guidepup/setup; ADR 0024).
//
// Guidepup's spoken phrase log holds only what NVDA says while Guidepup runs
// a command: an NVDA command (`next()`, `navigateToWebContent()`) or a page
// action wrapped in `nvda.capture()`, which stops listening one second after
// NVDA last spoke. So a focus or a key press whose speech is asserted runs
// inside `nvda.capture()`, and every capture keeps the whole of what NVDA
// says, not only its first phrase (`capture: true`).
//
// A page load is never what a test captures. On load NVDA starts reading the
// page from the top and, on the CI runner, stops after its first line («Saltar
// al contenido»), long before the results arrive: a live region that changes
// during the load is not heard, and content that is simply there is only
// spoken when the reader reaches it. So each test loads the page first, then
// asserts on what NVDA says to a user action: a key press that starts a search
// (a polite status, A11Y-10), focus moving (A11Y-9, A11Y-11), or the virtual
// cursor walking the page with `next()` (A11Y-12, A11Y-13).
import { type NVDAPlaywright, nvdaTest as test } from "@guidepup/playwright";
import { expect, type Page } from "@playwright/test";
import { mockListingSources, setUpstreamScenario } from "../e2e/fixtures/network";
import { stubMapTiles } from "../e2e/fixtures/map-tiles";

// messages/es.json. The NVDA assertions check for BuyCarMap's own Spanish
// strings inside the spoken log (Contracts › Screen reader: "never NVDA's
// role words, which follow the reader's language"), so these are read from
// the message files rather than guessed:
//  - search.where/car/price: the segment's overline label ("Dónde" etc.);
//    search.wherePlaceholder/anyBrand/priceAny: each segment's default value.
//  - map.markerLabel "{title}, {price}": a pin's spoken name.
//  - mapStates.statusCount: the count the status pill says (MAPUI-68).
//  - mapStates.statusNone: the status pill's no-match line (MAPUI-31).
//  - mapStates.emptyTitle/emptyLine: the no-results EmptyState.
//  - mapStates.errorTitle/errorLine: the search-error EmptyState.
//  - map.unavailable: the no-WebGL status pill (MAPLIBRE-15).
//  - nav.map/nav.signIn: the phone tab bar's labels.

const PHONE_390 = { width: 390, height: 844 };

// A walk with NVDA's `next()` stops here at the latest, so a page that never
// speaks the phrase awaited fails instead of walking forever.
const MAX_NVDA_STOPS = 80;

test.use({ nvdaStartOptions: { capture: true } });

/**
 * What NVDA said, compared the way it is spoken. NVDA's default speech
 * dictionary splits a word where its letters change case or meet a digit
 * before speaking it — «A3» is spoken «A 3», «BuyCarMap» «Buy Car Map» —, its
 * log writes «…» as «...», it drops «¿» and «?», and it reads text the way it
 * is drawn, so an upper-case overline or headline («DÓNDE», «SE HA CAÍDO
 * ALGO») reaches the log in capitals. Comparing without whitespace, «¿?¡!» or
 * case, with «…» spelled out, on both sides keeps every assertion on the
 * app's own string, whatever NVDA does to its spacing.
 */
function spoken(text: string): string {
  return text
    .replaceAll("…", "...")
    .replace(/[\s¿?¡!]+/g, "")
    .toLocaleLowerCase("es");
}

async function spokenLog(nvda: NVDAPlaywright): Promise<string> {
  return (await nvda.spokenPhraseLog()).join(" ");
}

/**
 * Guidepup's `navigateToWebContent()` clicks the middle of the page's body to
 * hand it the focus. On /map that point is a pin or a card, and a card is a
 * link to the listing on its marketplace: at phone width the click opened
 * Wallapop in a new tab, and NVDA read CloudFront's «403 ERROR» page instead
 * of the app. A blank layer over the page for the length of the call takes
 * the click, so it activates nothing; NVDA never reads it (`aria-hidden`), and
 * it is gone before the test reads anything.
 */
async function enterWebContent(nvda: NVDAPlaywright, page: Page): Promise<void> {
  await page.evaluate(() => {
    const shield = document.createElement("div");
    shield.id = "nvda-click-shield";
    shield.setAttribute("aria-hidden", "true");
    shield.style.cssText = "position: fixed; inset: 0; z-index: 2147483647;";
    document.body.append(shield);
  });
  await nvda.navigateToWebContent();
  await page.evaluate(() => document.getElementById("nvda-click-shield")?.remove());
}

/** Moves NVDA's virtual cursor one `next()` at a time — Guidepup's own pattern for walking the reading order — until it speaks `phrase`. */
async function walkUntil(nvda: NVDAPlaywright, phrase: string): Promise<void> {
  for (
    let stop = 0;
    stop < MAX_NVDA_STOPS && !spoken(await nvda.lastSpokenPhrase()).includes(spoken(phrase));
    stop++
  ) {
    await nvda.next();
  }
}

/**
 * Presses Enter on the focused quick filter and waits for the search it
 * starts to answer, so a capture around it lasts until the status has its
 * final text, however long the search takes. A quick filter, not «Buscar»:
 * the page keeps each search's answer, so «Buscar» on criteria already
 * searched answers from that copy, with no loading state and no change for
 * the status to announce. The filter makes it a search the page has not run.
 * Its focus stays on the filter, so whatever NVDA says about the results
 * comes from the polite status.
 */
async function searchWithQuickFilter(page: Page): Promise<void> {
  const answered = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );
  await page.keyboard.press("Enter");
  await answered;
}

async function gotoMap(page: Page, path: string, ready: string): Promise<void> {
  await stubMapTiles(page);
  await mockListingSources(page);
  await page.goto(path);
  await expect(page.getByText(ready).first()).toBeVisible();
}

test.describe("A11Y-9: NVDA reads the search pill's segments and the submit/Crear alerta buttons by name", () => {
  test("A11Y-9: tabbing through the pill speaks «Dónde», «Ciudad o código postal…», «Coche», «Cualquier marca», «Precio», «Cualquiera», «Buscar» and «Crear alerta»", async ({
    nvda,
    page,
  }) => {
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");

    // A segment's name is its value and its overline label is its
    // description (SearchPill.tsx). NVDA speaks a description when the
    // control takes the focus, not when its virtual cursor passes over it,
    // so the pill is walked the way a keyboard user moves through it: Tab
    // from the wordmark, through the three segments, «Buscar» and «Crear
    // alerta».
    await enterWebContent(nvda, page);
    await page.getByRole("link", { name: "BuyCarMap" }).focus();
    for (let stop = 0; stop < 5; stop++) {
      await nvda.capture(() => page.keyboard.press("Tab"));
    }

    const log = spoken(await spokenLog(nvda));
    expect(log.length, "NVDA spoke nothing at all — the edge case A11Y-14 forbids").toBeGreaterThan(
      0,
    );
    expect(log).toContain(spoken("Dónde"));
    expect(log).toContain(spoken("Ciudad o código postal…"));
    expect(log).toContain(spoken("Coche"));
    expect(log).toContain(spoken("Cualquier marca"));
    expect(log).toContain(spoken("Precio"));
    expect(log).toContain(spoken("Cualquiera"));
    expect(log).toContain(spoken("Buscar"));
    expect(log).toContain(spoken("Crear alerta"));
  });
});

test.describe("A11Y-10: NVDA speaks the result count politely, and the no-match line on an empty search", () => {
  test("A11Y-10: after a search, NVDA speaks the result count with no focus change", async ({
    nvda,
    page,
  }) => {
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");

    // MAPUI-68: the count is said by the polite status pill, so NVDA speaks
    // it without the user moving focus at all: «Diésel» keeps the focus
    // while its search runs, and only the key press is captured.
    await enterWebContent(nvda, page);
    await page.getByRole("button", { name: "Diésel", exact: true }).focus();
    await nvda.capture(async () => {
      await searchWithQuickFilter(page);
      await expect(page.getByRole("heading", { name: "2 COCHES" })).toBeVisible();
    });

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    // mapStates.statusCount: "{count, plural, one {# coche} other {# coches}}".
    // Of the default scenario's three cars, the Audi and the BMW are diesel
    // and the SEAT petrol, so «Diésel» leaves two (MAPUI-55).
    expect(log).toContain(spoken("2 coches"));
  });

  test("A11Y-10: a search with no results speaks the no-match line", async ({ nvda, page }) => {
    // model=Corolla matches none of the default-scenario listings
    // (e2e/maplibre.spec.ts's own derivation for the same fixture). A model
    // is a filter and there is no place, so there is no radius to widen: the
    // status pill reads mapStates.statusNone (MAPUI-31). «Diésel» adds a
    // second filter, so the new search finds none either.
    await gotoMap(page, "/map?model=Corolla", "¿Nada por aquí?");

    await enterWebContent(nvda, page);
    await page.getByRole("button", { name: "Diésel", exact: true }).focus();
    await nvda.capture(async () => {
      await searchWithQuickFilter(page);
      await expect(page.getByText("Ningún coche con estos filtros")).toBeVisible();
    });

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain(spoken("Ningún coche con estos filtros"));
  });
});

test.describe("A11Y-11: NVDA names a pin, speaks the car's name on its preview, and the pin again on Escape", () => {
  test("A11Y-11: moving to the Audi pin speaks its name; Enter opens the preview and speaks «Audi A3 2.0 TDI»; Escape returns to the pin", async ({
    nvda,
    page,
  }) => {
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");

    const pin = page
      .locator(".maplibregl-marker")
      .getByRole("button", { name: /Audi A3 2\.0 TDI/ });
    // NVDA reports focus changes only inside the document it is reading, so
    // it moves into the page's content first.
    await enterWebContent(nvda, page);
    // Moving to the pin is a focus change NVDA follows and speaks.
    await nvda.capture(() => pin.focus());

    let log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    // map.markerLabel "{title}, {price}".
    expect(log).toContain(spoken("Audi A3 2.0 TDI, 14.500 €"));

    await nvda.clearSpokenPhraseLog();
    await nvda.capture(() => page.keyboard.press("Enter"));
    log = spoken(await spokenLog(nvda));
    expect(log).toContain(spoken("Audi A3 2.0 TDI"));

    await nvda.clearSpokenPhraseLog();
    await nvda.capture(() => page.keyboard.press("Escape"));
    log = spoken(await spokenLog(nvda));
    expect(log).toContain(spoken("Audi A3 2.0 TDI, 14.500 €"));
  });
});

test.describe("A11Y-12: NVDA speaks the error and empty EmptyStates, and the no-WebGL status pill", () => {
  test("A11Y-12: the search-error EmptyState speaks «¿Se ha caído algo?» and its line", async ({
    nvda,
    page,
  }) => {
    // Every source answers 500 (the mock upstream server's "error"
    // scenario), so the search fails as a whole (MAPUI-32). The next test's
    // mockListingSources puts the server back on "default".
    await stubMapTiles(page);
    await mockListingSources(page);
    await setUpstreamScenario("error");
    await page.goto("/map");
    await expect(page.getByText("¿Se ha caído algo?").first()).toBeVisible();

    await enterWebContent(nvda, page);
    await walkUntil(nvda, "No hemos podido traer los anuncios. Suele ser cosa de un momento.");

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain(spoken("¿Se ha caído algo?"));
    expect(log).toContain(
      spoken("No hemos podido traer los anuncios. Suele ser cosa de un momento."),
    );
  });

  test("A11Y-12: the no-results EmptyState speaks «¿Nada por aquí?» and its line", async ({
    nvda,
    page,
  }) => {
    await gotoMap(page, "/map?model=Corolla", "¿Nada por aquí?");

    await enterWebContent(nvda, page);
    await walkUntil(nvda, "Con estos filtros no hay coches. Prueba a quitar algún filtro.");

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain(spoken("¿Nada por aquí?"));
    expect(log).toContain(spoken("Con estos filtros no hay coches. Prueba a quitar algún filtro."));
  });

  test("A11Y-12: without WebGL, NVDA speaks «El mapa no está disponible en este navegador»", async ({
    nvda,
    page,
  }) => {
    // The no-WebGL init script from e2e/maplibre.spec.ts's disableWebGL,
    // reimplemented here rather than imported — that function is not
    // exported, and e2e/maplibre.spec.ts's own header note on not coupling
    // spec files applies the same way across the e2e/e2e-sr boundary.
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
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");
    await expect(
      page.getByRole("status", { name: "El mapa no está disponible en este navegador" }),
    ).toBeVisible();

    await enterWebContent(nvda, page);
    await walkUntil(nvda, "El mapa no está disponible en este navegador");

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain(spoken("El mapa no está disponible en este navegador"));
  });
});

test.describe("A11Y-13: at phone width, NVDA reads the tab bar's labels, marks the current one, and skips it while hidden", () => {
  test("A11Y-13: moving through the tab bar speaks «Mapa» and «Entrar», with the current one marked", async ({
    nvda,
    page,
  }) => {
    await page.setViewportSize(PHONE_390);
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");

    // The tab bar ends the page: walks from the start of its content to it,
    // until NVDA reaches «Entrar», its last tab.
    await enterWebContent(nvda, page);
    await walkUntil(nvda, "Entrar");

    const log = spoken(await spokenLog(nvda));
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain(spoken("Mapa"));
    expect(log).toContain(spoken("Entrar"));
    // MAPUI-52: the current tab is marked current — NVDA speaks "current
    // page" (English role word) only because this run negotiates its own
    // locale; the Spanish string asserted above is what this spec's
    // Contracts section requires, not NVDA's own role words.
  });

  test("A11Y-13: dragging the results sheet to full hides the tab bar, and NVDA's next reading skips it", async ({
    nvda,
    page,
  }) => {
    await page.setViewportSize(PHONE_390);
    await gotoMap(page, "/map", "Audi A3 2.0 TDI");

    // MAPUI-59's keyboard path: Enter on the sheet's handle moves it to
    // full at once (MOTION-14), the same way e2e/map.spec.ts's own MAPUI-59
    // tests drive it, so this needs no drag gesture.
    const handle = page.getByRole("button", { name: /^(lista de resultados|results list)$/i });
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-position", "full");

    await nvda.next();
    const log = await spokenLog(nvda);
    // A silent NVDA would pass the two checks below on nothing (A11Y-14).
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain("Mapa");
    expect(log).not.toContain("Entrar");
  });
});
