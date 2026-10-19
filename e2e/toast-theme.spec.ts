import { test, expect, type Page } from "@playwright/test";
import { e2eEmail, seedUser } from "./fixtures/db";
import { mockListingSources } from "./fixtures/network";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// FRONT-23 (amended 2026-10-12, LOOK — redesign-foundation.md, LOOK-14): the
// toast takes its colours from the design tokens surface/line/text, in the
// app's single dark theme — there is no other theme to compare against any
// more. Expected values are LOOK-1's token hex values converted to rgb by
// hand: surface #18181B -> rgb(24, 24, 27), line #2A2A2E -> rgb(42, 42, 46),
// text #F4F2F0 -> rgb(244, 242, 240). Before the FRONT-23 fix the toast read
// rgb(255, 255, 255), which is why that value is still checked against.
//
// Amended again by docs/specs/redesign-entry.md's own "Criteria amended"
// list: FRONT-23's trigger moves from the sign-in failure toast — which
// ENTRY-11/ENTRY-12 replace with an inline alert, so there is no toast left
// to trigger there — to the "Alerta creada" toast on /map, which needs a
// signed-in, seeded user and so only runs in the DB suite (E2E_DB), the same
// gate e2e/alerts.spec.ts's own MAPUI-47 end-to-end test uses.
const dbTest = process.env.E2E_DB ? test : test.skip;
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

interface ToastColours {
  backgroundColor: string;
  borderTopColor: string;
  color: string;
}

async function toastColours(page: Page): Promise<ToastColours> {
  const email = e2eEmail("toasttheme");
  await seedUser(email, PASSWORD, "Toast Theme User");
  await mockListingSources(page);

  await signIn(page, email);
  await page.goto("/map?make=Toyota&maxPrice=20000");

  await page
    .getByRole("button", { name: /crear alerta|create alert/i })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /crear alerta|create alert/i })
    .click();

  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  return toast.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      color: style.color,
    };
  });
}

dbTest(
  "FRONT-23: the Alerta creada toast on /map uses the surface/line/text design tokens in the single dark theme (amended by docs/specs/redesign-entry.md, ENTRY-11/ENTRY-12 having removed the sign-in toast this used to trigger on)",
  async ({ page }) => {
    const colours = await toastColours(page);

    expect(colours.backgroundColor).not.toBe("rgb(255, 255, 255)");
    expect(colours.backgroundColor).toBe("rgb(24, 24, 27)");
    expect(colours.borderTopColor).toBe("rgb(42, 42, 46)");
    expect(colours.color).toBe("rgb(244, 242, 240)");
  },
);
