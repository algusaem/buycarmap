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
// action wrapped in `nvda.capture()`. So a load, a focus or a key press whose
// speech is asserted runs inside `nvda.capture()`, and every capture keeps
// the whole of what NVDA says, not only its first phrase (`capture: true`).
import { nvdaTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";
import { mockListingSources } from "../e2e/fixtures/network";
import { stubMapTiles } from "../e2e/fixtures/map-tiles";

// messages/es.json. The NVDA assertions check for BuyCarMap's own Spanish
// strings inside the spoken log (Contracts › Screen reader: "never NVDA's
// role words, which follow the reader's language"), so these are read from
// the message files rather than guessed:
//  - search.where/car/price: the segment's overline label ("Dónde" etc.);
//    search.allSpain/anyBrand/priceAny: each segment's default value.
//  - map.markerLabel "{title}, {price}": a pin's spoken name.
//  - map.preview "Vista previa del coche": the pin preview dialog's name.
//  - mapStates.headingCount/headingNone: the result count heading.
//  - mapStates.emptyTitle/emptyLine: the no-results EmptyState.
//  - mapStates.errorTitle/errorLine: the search-error EmptyState.
//  - map.unavailable: the no-WebGL status pill (MAPLIBRE-15).
//  - nav.map/nav.signIn: the phone tab bar's labels.

const PHONE_390 = { width: 390, height: 844 };

// A walk with NVDA's `next()` stops here at the latest, so a page that never
// speaks the phrase awaited fails instead of walking forever.
const MAX_NVDA_STOPS = 80;

test.use({ nvdaStartOptions: { capture: true } });

test.describe("A11Y-9: NVDA reads the search pill's segments and the submit/Crear alerta buttons by name", () => {
  test("A11Y-9: moving through the pill speaks «Dónde», «Toda España», «Coche», «Cualquier marca», «Precio», «Cualquiera», «Buscar» and «Crear alerta»", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    // From the start of the page's content, moves NVDA's virtual cursor one
    // `next()` at a time — Guidepup's own documented pattern for walking the
    // reading order — through the skip link, the wordmark, the pill's three
    // segments and the two buttons that follow it, until it reaches «Crear
    // alerta», the last of them.
    await nvda.navigateToWebContent();
    for (
      let stop = 0;
      stop < MAX_NVDA_STOPS && !(await nvda.lastSpokenPhrase()).includes("Crear alerta");
      stop++
    ) {
      await nvda.next();
    }

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length, "NVDA spoke nothing at all — the edge case A11Y-14 forbids").toBeGreaterThan(
      0,
    );
    expect(log).toContain("Dónde");
    expect(log).toContain("Toda España");
    expect(log).toContain("Coche");
    expect(log).toContain("Cualquier marca");
    expect(log).toContain("Precio");
    expect(log).toContain("Cualquiera");
    expect(log).toContain("Buscar");
    expect(log).toContain("Crear alerta");
  });
});

test.describe("A11Y-10: NVDA speaks the result count politely, and the no-match line on an empty search", () => {
  test("A11Y-10: after a search, NVDA speaks the result count with no focus change", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);

    // MAPUI-3/MAP-20: the count is a polite aria-live status, so NVDA speaks
    // it without the user moving focus at all — no nvda.next() here, only
    // the load, captured.
    await nvda.capture(async () => {
      await page.goto("/map");
      await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
    });
    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    // mapStates.headingCount: "{count, plural, one {# COCHE} other {# COCHES}}" — 3 cars, default scenario.
    expect(log).toMatch(/3\s*COCHES/i);
  });

  test("A11Y-10: a search with no results speaks the no-match line", async ({ nvda, page }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    // model=Corolla matches none of the default-scenario listings
    // (e2e/maplibre.spec.ts's own derivation for the same fixture).
    await nvda.capture(async () => {
      await page.goto("/map?model=Corolla");
      await page.getByText("¿Nada por aquí?").first().waitFor();
    });

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    // mapStates.emptyTitle + emptyLine.
    expect(log).toContain("¿Nada por aquí?");
    expect(log).toContain("Con estos filtros no hay coches. Prueba a quitar algún filtro.");
  });
});

test.describe("A11Y-11: NVDA names a pin, speaks the car's name on its preview, and the pin again on Escape", () => {
  test("A11Y-11: moving to the Audi pin speaks its name; Enter opens the preview and speaks «Audi A3 2.0 TDI»; Escape returns to the pin", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    const pin = page
      .locator(".maplibregl-marker")
      .getByRole("button", { name: /Audi A3 2\.0 TDI/ });
    // Moving to the pin is a focus change NVDA follows and speaks.
    await nvda.capture(() => pin.focus());

    let log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    // map.markerLabel "{title}, {price}".
    expect(log).toContain("Audi A3 2.0 TDI");

    await nvda.capture(() => page.keyboard.press("Enter"));
    log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log).toContain("Audi A3 2.0 TDI");

    await nvda.capture(() => page.keyboard.press("Escape"));
    log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log).toContain("Audi A3 2.0 TDI");
  });
});

test.describe("A11Y-12: NVDA speaks the error and empty EmptyStates, and the no-WebGL status pill", () => {
  test("A11Y-12: the search-error EmptyState speaks «¿Se ha caído algo?» and its line", async ({
    nvda,
    page,
  }) => {
    // No mockListingSources: the upstream mock server is not pointed at, so
    // the Next dev server's own fetches to the real upstream hosts fail —
    // the same "search fails" path e2e/map-error.spec.ts (if any) exercises
    // elsewhere; here only the spoken EmptyState matters.
    await stubMapTiles(page);
    await nvda.capture(async () => {
      await page.goto("/map");
      await page.getByText("¿Se ha caído algo?").first().waitFor();
    });

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain("¿Se ha caído algo?");
    expect(log).toContain("No hemos podido traer los anuncios. Suele ser cosa de un momento.");
  });

  test("A11Y-12: the no-results EmptyState speaks «¿Nada por aquí?» and its line", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await nvda.capture(async () => {
      await page.goto("/map?model=Corolla");
      await page.getByText("¿Nada por aquí?").first().waitFor();
    });

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log).toContain("¿Nada por aquí?");
    expect(log).toContain("Con estos filtros no hay coches. Prueba a quitar algún filtro.");
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
    await stubMapTiles(page);
    await mockListingSources(page);
    await nvda.capture(async () => {
      await page.goto("/map");
      await page
        .getByRole("status", { name: "El mapa no está disponible en este navegador" })
        .waitFor();
    });

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain("El mapa no está disponible en este navegador");
  });
});

test.describe("A11Y-13: at phone width, NVDA reads the tab bar's labels, marks the current one, and skips it while hidden", () => {
  test("A11Y-13: moving through the tab bar speaks «Mapa» and «Entrar», with the current one marked", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(PHONE_390);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    // The tab bar ends the page: walks from the start of its content to it,
    // until NVDA reaches «Entrar», its last tab.
    await nvda.navigateToWebContent();
    for (
      let stop = 0;
      stop < MAX_NVDA_STOPS && !(await nvda.lastSpokenPhrase()).includes("Entrar");
      stop++
    ) {
      await nvda.next();
    }

    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log.length).toBeGreaterThan(0);
    expect(log).toContain("Mapa");
    expect(log).toContain("Entrar");
    // MAPUI-52: the current tab is marked current — NVDA speaks "current
    // page" (English role word) only because this run negotiates its own
    // locale; the Spanish string asserted above is what this spec's
    // Contracts section requires, not NVDA's own role words.
  });

  test("A11Y-13: dragging the results sheet to full hides the tab bar, and NVDA's next reading skips it", async ({
    nvda,
    page,
  }) => {
    await stubMapTiles(page);
    await mockListingSources(page);
    await page.setViewportSize(PHONE_390);
    await page.goto("/map");
    await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();

    // MAPUI-59's keyboard path: Enter on the sheet's handle moves it to
    // full at once (MOTION-14), the same way e2e/map.spec.ts's own MAPUI-59
    // tests drive it, so this needs no drag gesture.
    const handle = page.getByRole("button", { name: /^(lista de resultados|results list)$/i });
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-position", "full");

    await nvda.next();
    const log = (await nvda.spokenPhraseLog()).join(" ");
    expect(log).not.toContain("Mapa");
    expect(log).not.toContain("Entrar");
  });
});
