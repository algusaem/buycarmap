import { type Browser, chromium, type FullConfig, webkit } from "@playwright/test";
import { stubMapTiles } from "./fixtures/map-tiles";

// `next dev` compiles each route on its first request, which for this app takes
// seconds. Without warming, that cost lands inside whichever test happens to
// visit a route first — and with several workers hitting different cold routes
// at once the compile queue serializes, blowing the 30s test timeout on tests
// that pass fine in isolation.
//
// Requesting every route once, serially, moves that cost here where there is no
// timeout to bust. Matters most in CI, where the server is always cold.

const ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email",
  "/map",
];

const READY_TIMEOUT_MS = 120_000;
const ROUTE_TIMEOUT_MS = 120_000;

// Must match playwright.config.ts's own default (E2E_UPSTREAM_PORT) and
// e2e/fixtures/network.ts's — duplicated rather than shared through a fourth
// file, per this suite's own convention of favouring a few repeated lines
// over coupling files together (see favorites.spec.ts's header comment).
const UPSTREAM_PORT = process.env.E2E_UPSTREAM_PORT ?? "3912";

async function waitForServer(baseURL: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL, {
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Dev server did not become ready at ${baseURL}`);
}

// FRONT-22 (docs/specs/core-frontend.md): resets the mock upstream server
// (e2e/fixtures/upstream-server.ts) to its "default" scenario. The reset runs
// unconditionally, so every run starts from "default" regardless of whatever
// scenario an earlier spec file — e.g. screenshots.spec.ts's "empty" — left
// set.
async function resetUpstreamScenario(): Promise<void> {
  const response = await fetch(`http://localhost:${UPSTREAM_PORT}/__scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "default" }),
  });
  if (!response.ok) {
    throw new Error(`Failed to reset e2e upstream scenario: ${response.status}`);
  }
}

// The HTML fetches above compile each route, but not the client code a page
// asks for only once it runs: ListingsMap's lazy chunk, maplibre-gl and its
// web worker (components/map/MapResultsArea.tsx, lib/hooks/useMapLibre.ts).
// Unwarmed, that compile landed inside the first test that drew a map — on
// the WebKit job, whose first test is e2e/map.spec.ts's pin check, the pins
// came after its 5s assertion in two runs out of three, with the cards
// already listed. One real page load of /map, until its first pin is on the
// map, compiles all of it here instead.
//
// The browser is whichever one this job installed: the WebKit job installs
// only WebKit, every other job Chromium.
async function launchInstalledBrowser(): Promise<Browser | null> {
  for (const browserType of [chromium, webkit]) {
    try {
      return await browserType.launch();
    } catch {
      // Not installed in this job: try the next one.
    }
  }
  return null;
}

async function warmMap(baseURL: string): Promise<void> {
  const browser = await launchInstalledBrowser();
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await stubMapTiles(page);
    await page.goto(new URL("/map", baseURL).href, { timeout: ROUTE_TIMEOUT_MS });
    await page
      .locator(".maplibregl-marker")
      .first()
      .waitFor({ state: "attached", timeout: ROUTE_TIMEOUT_MS });
  } catch {
    // As with the routes above: a map that fails to warm is reported by the
    // tests that draw it, with far better context.
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  // Against a deployed preview (ENV-5, docs/specs/core-environments.md) the
  // deployment is already live and there is no local dev server or mock
  // upstream server to wait for or reset.
  if (process.env.E2E_BASE_URL) return;

  await waitForServer(baseURL);
  await resetUpstreamScenario();

  for (const route of ROUTES) {
    try {
      await fetch(new URL(route, baseURL), {
        signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
      });
    } catch {
      // A route that fails to warm is not a setup failure — the test that
      // covers it will report the real problem with far better context.
    }
  }

  await warmMap(baseURL);
}
