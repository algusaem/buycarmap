import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser } from "./fixtures/db";

// FRONT-19 (docs/specs/core-frontend.md): the contrast rule is no longer
// disabled, and every main flow passes axe with no serious/critical
// violation in both themes. Any token or colour change needed to get there
// is an owner approval this spec does not itself make (RULES.md §1, §17) —
// this file only states the bar; fixing today's known contrast failures
// (docs/ARCHITECTURE.md › Testing › Known findings, unfixed) is separate
// work.

const dbTest = process.env.E2E_DB ? test : test.skip;
// Clears all three password layers (length, strength, breach corpus) —
// duplicated from auth.spec.ts/favorites.spec.ts rather than shared, per
// their own convention (five lines of page-object glue isn't worth coupling
// two spec files together to save).
const PASSWORD = "harbour-lentil-quilt-97";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  // next-themes persists to localStorage under the default key "theme"
  // (components/ThemeProvider.tsx passes no storageKey override) — set it
  // before the app boots so there is no flash of the other theme to race.
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme", value);
  }, theme);
}

async function seriousViolations(page: Page) {
  // Mount animations (fadeInUp) fade whole cards in from opacity 0; axe
  // sampling mid-fade reports contrast against a half-transparent colour.
  // Infinite animations (spinners, ambient backgrounds) never finish, so only
  // finite ones are waited on. Motion drives some fades from JS rather than
  // the Web Animations API, writing inline `opacity`, so any inline opacity
  // below 1 means the fade is still running — or, before hydration, has not
  // started yet (the server renders the `initial` opacity 0).
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .every((animation) => animation.playState !== "running") &&
      Array.from(document.querySelectorAll<HTMLElement>("[style*='opacity']")).every((element) => {
        const opacity = Number.parseFloat(element.style.opacity);
        return Number.isNaN(opacity) || opacity === 1;
      }),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

function expectNoSeriousViolations(violations: Awaited<ReturnType<typeof seriousViolations>>) {
  expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
}

const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  for (const path of ["/", "/login", "/register"]) {
    test(`FRONT-19: no serious accessibility violations on ${path} (${theme})`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await page.goto(path);
      expectNoSeriousViolations(await seriousViolations(page));
    });
  }

  test(`FRONT-19: no serious accessibility violations on /map (${theme})`, async ({ page }) => {
    await setTheme(page, theme);
    await mockListingSources(page);
    await page.goto("/map");
    await page.getByText("Audi A3 2.0 TDI").waitFor();
    expectNoSeriousViolations(await seriousViolations(page));
  });

  // /favorites, /alerts and /account need a signed-in session, which this
  // suite only has against a real database (E2E_DB) — the same gate
  // e2e/favorites.spec.ts uses for its round trips. Skipped, not silently
  // dropped, when E2E_DB is unset (as in plain `pnpm test:e2e`/CI).
  dbTest(
    `FRONT-19: no serious accessibility violations on /favorites (${theme})`,
    async ({ page }) => {
      const email = e2eEmail("a11y-fav");
      await seedUser(email, PASSWORD);
      await setTheme(page, theme);
      await signIn(page, email);

      await page.goto("/favorites");
      expectNoSeriousViolations(await seriousViolations(page));
    },
  );

  dbTest(
    `FRONT-19: no serious accessibility violations on /alerts (${theme})`,
    async ({ page }) => {
      const email = e2eEmail("a11y-alerts");
      await seedUser(email, PASSWORD);
      await setTheme(page, theme);
      await signIn(page, email);

      await page.goto("/alerts");
      expectNoSeriousViolations(await seriousViolations(page));
    },
  );

  dbTest(
    `FRONT-19: no serious accessibility violations on /account (${theme})`,
    async ({ page }) => {
      const email = e2eEmail("a11y-account");
      await seedUser(email, PASSWORD);
      await setTheme(page, theme);
      await signIn(page, email);

      await page.goto("/account");
      expectNoSeriousViolations(await seriousViolations(page));
    },
  );
}
