import { test, expect, type Page, type Response } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser } from "./fixtures/db";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// PLAT-21 (e2e half) and PLAT-23 (docs/specs/core-platform.md, amended
// 2026-10-12, LOOK — redesign-foundation.md): the CSP moves from a static
// header in next.config.ts to a per-request nonce in proxy.ts. The nonce no
// longer feeds a theme bootstrap script — next-themes is gone — and the map,
// login and favorites pages keep working under it with no CSP violation
// reported to the console.

const dbTest = process.env.E2E_DB ? test : test.skip;
// Duplicated from e2e/a11y.spec.ts/favorites.spec.ts rather than shared, per
// their own convention.
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

function scriptSrcDirective(response: Response): string | undefined {
  const csp = response.headers()["content-security-policy"] ?? "";
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src"));
}

async function cspViolationMessages(page: Page): Promise<string[]> {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (/content[- ]security[- ]policy/i.test(message.text())) messages.push(message.text());
  });
  return messages;
}

for (const path of ["/", "/login", "/map"]) {
  test(`PLAT-21: ${path} sends a nonce-based CSP with no 'unsafe-inline' in script-src`, async ({
    page,
  }) => {
    if (path === "/map") await mockListingSources(page);

    const response = await page.goto(path);
    expect(response).not.toBeNull();

    const scriptSrc = scriptSrcDirective(response as Response);
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toMatch(/'nonce-/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test(`PLAT-23: ${path} reports no Content-Security-Policy violation in the console`, async ({
    page,
  }) => {
    const violations = await cspViolationMessages(page);
    if (path === "/map") await mockListingSources(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });
}

dbTest(
  "PLAT-23: signing in and visiting /favorites reports no Content-Security-Policy violation in the console (amended 2026-10-12, LOOK — redesign-foundation.md)",
  async ({ page }) => {
    const email = e2eEmail("plat23-fav");
    await seedUser(email, PASSWORD);

    const violations = await cspViolationMessages(page);

    await signIn(page, email);
    await page.goto("/favorites");
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  },
);
