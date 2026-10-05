import { test, expect } from "@playwright/test";

// ENV-5 (docs/specs/core-environments.md): a short smoke suite that runs
// against a real deployed URL, named by E2E_BASE_URL, with Vercel's
// Deployment Protection bypass header on every request. Only
// .github/workflows/e2e-preview.yml (ENV-6) sets E2E_BASE_URL, once a real
// preview deployment goes live — a local `pnpm test:e2e` run never sets it,
// so this file skips itself entirely rather than failing with no target.
const BASE_URL = process.env.E2E_BASE_URL;
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const BYPASS_HEADERS = { "x-vercel-protection-bypass": BYPASS_SECRET };

test.skip(
  !process.env.E2E_BASE_URL,
  "E2E_BASE_URL is not set; this spec only runs against a real preview deployment",
);

test.describe("ENV-5: preview smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders(BYPASS_HEADERS);
  });

  test("ENV-5: / returns 200 and shows the app", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/`);

    expect(response?.status()).toBe(200);
    // app/layout.tsx's generateMetadata renders messages["meta"]["title"]
    // ("Buy Car Map" in both es.json and en.json) as the document <title>.
    await expect(page).toHaveTitle(/Buy Car Map/);
  });

  test("ENV-5: /login renders the sign-in form", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await expect(page.getByLabel(/email|correo/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("ENV-5: /api/health returns 200", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, { headers: BYPASS_HEADERS });

    expect(response.status()).toBe(200);
  });

  test("ENV-5: /api/auth/ok returns { ok: true }", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/ok`, { headers: BYPASS_HEADERS });

    expect(await response.json()).toEqual({ ok: true });
  });
});
