import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";

// EXPORT-18 (docs/specs/account-data-export.md): a real browser receiving a
// real download from a real session. It needs a database, so it runs only in
// `pnpm test:e2e:db` (E2E_DB=1); global teardown sweeps the seeded account.
const dbTest = process.env.E2E_DB ? test : test.skip;

// Clears all three password layers (length, strength, breach corpus).
const PASSWORD = "harbour-lentil-quilt-97";

// messages/en.json account.export.submit: "Download my data";
// messages/es.json: "Descargar mis datos".
const DOWNLOAD_MY_DATA = /download my data|descargar mis datos/i;

// Deliberately duplicated from auth.spec.ts rather than shared, as
// favorites.spec.ts does: five lines of page-object glue.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

dbTest(
  "EXPORT-18: a signed-in user downloads a JSON file holding their own data",
  async ({ page }) => {
    const email = e2eEmail("export");
    await seedUser(email, PASSWORD);
    await signIn(page, email);

    await page.goto("/account");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: DOWNLOAD_MY_DATA }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^buycarmap-data-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const data = JSON.parse(await readFile(path, "utf8"));
    expect(data.profile.email).toBe(email);
    expect(download.suggestedFilename()).toBe(
      `buycarmap-data-${String(data.exportedAt).slice(0, 10)}.json`,
    );
  },
);
