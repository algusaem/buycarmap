import { test, expect, type Page } from "@playwright/test";
import { box, expectWithin } from "./fixtures/measure";
import { e2eEmail, seedUser } from "./fixtures/db";

// docs/specs/redesign-pages.md (PAGES-64, PAGES-67). PAGES-7, PAGES-8,
// PAGES-64, PAGES-70 and the signed-out half of PAGES-67 need no database
// (Contracts › Tests); the signed-in half of PAGES-67 runs only in
// `pnpm test:e2e:db` (`pnpm db:branch` first), as HEAD-15, HEAD-8 and ENTRY-8
// already do in e2e/navigation.spec.ts.
const dbTest = process.env.E2E_DB ? test : test.skip;

// The spec quotes the Spanish copy, the default locale; Playwright negotiates
// "en-US" otherwise (e2e/pages-access.spec.ts).
test.use({ locale: "es-ES" });
const PASSWORD = "harbour-lentil-quilt-97";

const DESKTOP_1440 = { width: 1440, height: 900 };
const DESKTOP_1024 = { width: 1024, height: 900 };

// Deliberately duplicated from e2e/navigation.spec.ts rather than shared —
// five lines of page-object glue, and coupling spec files together to save
// them would make either harder to change alone.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe("PAGES-64: /privacy and /terms — the index layout", () => {
  test("PAGES-64: at 1440×900 the index is 260px wide, 72px left of a reading column at most 720px wide", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/privacy");

    const nav = page.getByRole("navigation", { name: "En esta página" });
    const column = page.locator("article").first();
    const navBox = await box(nav);
    const columnBox = await box(column);

    expectWithin(navBox.width, 260, "index width");
    expectWithin(
      columnBox.x - (navBox.x + navBox.width),
      72,
      "gap between the index and the column",
    );
    expect(columnBox.width, "reading column at most 720px").toBeLessThanOrEqual(721);
  });

  test("PAGES-64: at 1024×900 the reading column is 596px wide", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1024);
    await page.goto("/privacy");

    const column = page.locator("article").first();
    expectWithin((await box(column)).width, 596, "reading column width at 1024px");
  });

  test("PAGES-64: scrolling the text keeps the index in place and moves the current mark to the section on screen", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/privacy");

    const nav = page.getByRole("navigation", { name: "En esta página" });
    const before = await box(nav);
    const firstCurrent = await nav.locator('[aria-current="location"]').first().textContent();

    const column = await box(page.locator("article").first());
    await page.mouse.move(column.x + column.width / 2, column.y + 200);
    await page.mouse.wheel(0, 3000);
    // Waits on the boundary itself: the current mark leaving the first section.
    await expect(nav.locator('[aria-current="location"]')).not.toHaveText(firstCurrent ?? "");

    const after = await box(nav);
    expect(
      Math.abs(after.x - before.x),
      "the index does not move horizontally",
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y), "the index does not move vertically").toBeLessThanOrEqual(
      1,
    );

    const current = nav.locator('[aria-current="location"]');
    await expect(current, "exactly one section is marked current").toHaveCount(1);
    const laterCurrent = await current.textContent();
    expect(laterCurrent, "the current mark moved to a later section").not.toBe(firstCurrent);
  });

  test("PAGES-64: opening /privacy#<the Cookies id> shows «Cookies» with its heading wholly below the header, marked current", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/privacy");

    const cookiesHeading = page.getByRole("heading", { level: 2, name: "Cookies" });
    const id = await cookiesHeading.getAttribute("id");
    expect(id, "the Cookies heading has a stable id").toBeTruthy();

    await page.goto(`/privacy#${id}`);

    const headerBox = await box(page.locator("header").first());
    const headingBox = await box(page.getByRole("heading", { level: 2, name: "Cookies" }));
    expect(headingBox.y, "the Cookies heading is wholly below the header").toBeGreaterThanOrEqual(
      headerBox.y + headerBox.height,
    );

    const link = page.getByRole("navigation", { name: "En esta página" }).getByRole("link", {
      name: "Cookies",
    });
    await expect(link).toHaveAttribute("aria-current", "location");
  });
});

test.describe("PAGES-63: the phone index's links are 44px targets", () => {
  test("PAGES-63: at 390×844, every link of the open index is at least 44px tall", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/privacy");

    await page.getByRole("button", { name: "En esta página" }).click();
    const index = page.getByRole("navigation", { name: "En esta página" });
    const links = index.getByRole("link");
    await expect(links.first()).toBeVisible();
    // Measured once the list has finished sliding in, not mid-animation.
    await expect(index.locator("ul")).toHaveCSS("transform", "none");

    const count = await links.count();
    expect(count, "the index lists the sections").toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const linkBox = await box(links.nth(i));
      expect(linkBox.height, `link ${i + 1} at least 44px tall`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("PAGES-67: the not-found page", () => {
  test("PAGES-67: GET /esto-no-existe answers 404 and shows the not-found page, signed out", async ({
    page,
  }) => {
    const response = await page.goto("/esto-no-existe");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Te has perdido?");
    // The header carries its own «Volver al mapa»; the page's is in <main>.
    await expect(
      page.getByRole("main").getByRole("link", { name: "Volver al mapa" }),
    ).toHaveAttribute("href", "/map");
  });

  // docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles"):
  // the tab title as the browser shows it, not only generateMetadata's answer.
  test("PAGES-69: the not-found page's tab title is «Esto no existe · Buy Car Map»", async ({
    page,
  }) => {
    await page.goto("/esto-no-existe");

    await expect(page).toHaveTitle("Esto no existe · Buy Car Map");
  });

  dbTest(
    "PAGES-67: signed in, GET /esto-no-existe answers 404 and shows the pages header with no section current",
    async ({ page }) => {
      const email = e2eEmail("pages-legal-404");
      await seedUser(email, PASSWORD);
      await signIn(page, email);

      const response = await page.goto("/esto-no-existe");

      expect(response?.status()).toBe(404);
      const header = page.getByTestId("header-desktop");
      await expect(header.getByRole("link", { name: "Guardados" })).toBeVisible();
      expect(await header.locator('[aria-current="page"]').count(), "no section current").toBe(0);
    },
  );
});

// PAGES-67's «in the request's locale»: `es` is also the default locale, so
// only a request asking for English shows the page follows the request.
test.describe("PAGES-67: the not-found page in the request's locale", () => {
  test.use({ locale: "en-US" });

  test("PAGES-67: GET /esto-no-existe answers 404 and shows the not-found page in English when the request asks for it", async ({
    page,
  }) => {
    const response = await page.goto("/esto-no-existe");

    expect(response?.status()).toBe(404);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Lost your way?");
    await expect(heading).toContainText("This doesn’t exist");
  });
});
