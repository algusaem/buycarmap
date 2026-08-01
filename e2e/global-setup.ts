import type { FullConfig } from "@playwright/test";

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

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  await waitForServer(baseURL);

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
}
