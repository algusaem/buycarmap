import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedAlertMatches, seedAlerts, seedFavorites, seedUser } from "./fixtures/db";
import { signIn } from "./fixtures/session";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// FRONT-19 (docs/specs/core-frontend.md, amended 2026-10-12, LOOK —
// redesign-foundation.md): the contrast rule is no longer disabled, and
// every main flow passes axe with no serious/critical violation in the
// app's single dark theme (there is no other theme to check any more).
// LOOK-18 (docs/specs/redesign-foundation.md) is the same bar, named
// explicitly because it is the criterion that amends FRONT-19: axe,
// colour contrast included, on these same flows. Any token or colour
// that changes to get there is an owner approval this spec does not
// itself make (RULES.md §1, §17) — this file only states the bar; fixing
// today's known contrast failures (docs/ARCHITECTURE.md › Testing › Known
// findings, unfixed) is separate work.

const dbTest = process.env.E2E_DB ? test : test.skip;
// Clears all three password layers (length, strength, breach corpus). The
// sign-in itself is the shared one in e2e/fixtures/session.ts.
const PASSWORD = "harbour-lentil-quilt-97";

async function seriousViolations(page: Page) {
  // Mount animations (fadeInUp) fade whole cards in from opacity 0; axe
  // sampling mid-fade reports contrast against a half-transparent colour.
  // Infinite animations (spinners, ambient backgrounds) never finish, so only
  // finite ones are waited on. Motion drives some fades from JS rather than
  // the Web Animations API, writing inline `opacity`, so any inline opacity
  // below 1 means the fade is still running — or, before hydration, has not
  // started yet (the server renders the `initial` opacity 0). Radix's focus
  // guards around an open dialog carry a permanent inline `opacity: 0`, so
  // they are left out of the wait.
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .every((animation) => animation.playState !== "running") &&
      Array.from(
        document.querySelectorAll<HTMLElement>("[style*='opacity']:not([data-radix-focus-guard])"),
      ).every((element) => {
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

/** The flow helper both FRONT-19 and LOOK-18 reuse: load the page, settle, run axe. */
async function checkPage(page: Page, path: string) {
  if (path === "/map") {
    await mockListingSources(page);
    await page.goto(path);
    await page.getByText("Audi A3 2.0 TDI").waitFor();
  } else {
    await page.goto(path);
  }
  expectNoSeriousViolations(await seriousViolations(page));
}

/** The signed-in flow helper FRONT-19 and LOOK-18 reuse for the guarded pages. */
async function checkSignedInPage(page: Page, path: string, tag: string) {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  await signIn(page, email, PASSWORD);

  await page.goto(path);
  expectNoSeriousViolations(await seriousViolations(page));
}

const MAIN_PATHS = ["/", "/login", "/register", "/map"];

for (const path of MAIN_PATHS) {
  test(`FRONT-19: no serious accessibility violations on ${path}`, async ({ page }) => {
    await checkPage(page, path);
  });

  test(`LOOK-18: no serious accessibility violations on ${path}, colour contrast included, in the single dark theme`, async ({
    page,
  }) => {
    await checkPage(page, path);
  });
}

// docs/specs/redesign-entry.md (ENTRY-21, amends FRONT-19): "/" and "/login"
// now also run axe at phone width, not desktop only. The "mobile" Playwright
// project (playwright.config.ts) does not match this file (its `testMatch`
// is `/(map|auth|navigation)\.spec\.ts/`), so this sets the viewport
// directly inside the same chromium project this file already runs under,
// rather than widening that project's file match — unrelated test-infra
// wiring outside this change (RULES.md §1).
const MOBILE_VIEWPORT = { width: 375, height: 812 };

for (const path of ["/", "/login"]) {
  test(`ENTRY-21: no serious accessibility violations on ${path} at phone width`, async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await checkPage(page, path);
  });
}

// /favorites, /alerts and /account need a signed-in session, which this
// suite only has against a real database (E2E_DB) — the same gate
// e2e/favorites.spec.ts uses for its round trips. Skipped, not silently
// dropped, when E2E_DB is unset (as in plain `pnpm test:e2e`/CI).
const AUTH_PATHS: Array<{ path: string; tag: string }> = [
  { path: "/favorites", tag: "a11y-fav" },
  { path: "/alerts", tag: "a11y-alerts" },
  { path: "/account", tag: "a11y-account" },
];

for (const { path, tag } of AUTH_PATHS) {
  dbTest(`FRONT-19: no serious accessibility violations on ${path}`, async ({ page }) => {
    await checkSignedInPage(page, path, tag);
  });

  dbTest(
    `LOOK-18: no serious accessibility violations on ${path}, colour contrast included, in the single dark theme`,
    async ({ page }) => {
      await checkSignedInPage(page, path, `${tag}-look18`);
    },
  );
}

// docs/specs/redesign-saved.md (SAVED-33, amends FRONT-19): /favorites passes
// axe at desktop and phone width, with saved cars and with none. The cars are
// written straight into Postgres, two of them sharing one point so the
// grouped pin is on the page too.
const SAVED_CARS = [
  {
    listingId: "wallapop-a11y-1",
    title: "Audi A3 2.0 TDI",
    price: 14500,
    mileage: 95000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
    savedAt: new Date("2026-10-01T10:00:00Z"),
  },
  {
    listingId: "wallapop-a11y-2",
    title: "Toyota Corolla 125H",
    price: 19750,
    mileage: 48000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
    savedAt: new Date("2026-09-30T16:00:00Z"),
  },
  {
    listingId: "wallapop-a11y-3",
    title: "SEAT León 1.5 TSI",
    price: 16500,
    mileage: 64000,
    location: "Barcelona",
    lat: 41.3874,
    lng: 2.1686,
    savedAt: new Date("2026-10-03T09:00:00Z"),
  },
];

test.describe("SAVED-33: /favorites under axe", () => {
  // The checks below wait on the Spanish copy, the default locale; Playwright
  // negotiates en-US unless told otherwise.
  test.use({ locale: "es-ES" });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const withCars of [true, false]) {
      const state = withCars ? "with saved cars" : "with none";
      dbTest(
        `SAVED-33: no serious accessibility violations on /favorites at ${viewport.width}×${viewport.height}, ${state}`,
        async ({ page }) => {
          const email = e2eEmail(`a11y-saved-${viewport.width}-${withCars ? "cars" : "none"}`);
          await seedUser(email, PASSWORD);
          if (withCars) await seedFavorites(email, SAVED_CARS);
          await page.setViewportSize(viewport);
          await signIn(page, email, PASSWORD);

          await page.goto("/favorites");
          await expect(page.getByRole("heading", { level: 1, name: "Guardados" })).toBeVisible({
            timeout: 15_000,
          });
          if (withCars) await expect(page.getByText("Audi A3 2.0 TDI").first()).toBeVisible();
          else await expect(page.getByText("Guarda alguno")).toBeVisible();
          expectNoSeriousViolations(await seriousViolations(page));
        },
      );
    }
  }
});

// docs/specs/redesign-alerts.md (ALERTUI-43, amends FRONT-19): /alerts passes
// axe at desktop and phone width, with alerts and with none, and so does
// /alerts/[id] with matches and with none, with the confirmation open too.
// The alerts are written straight into Postgres (seedAlerts,
// seedAlertMatches): Corolla híbrido with its zone and two matches at one
// point, so the grouped pin is on the page, and Clio barato with none.
test.describe("ALERTUI-43: /alerts and /alerts/[id] under axe", () => {
  test.use({ locale: "es-ES" });

  const MATCH_AT_MADRID = {
    title: "Toyota Corolla 125H",
    price: 16200,
    mileage: 41000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
  };

  /** A fresh, signed-in account; with `alerts`, Corolla híbrido (two matches) and Clio barato (none). */
  async function openWithAlerts(
    page: Page,
    tag: string,
    viewport: { width: number; height: number },
    alerts: boolean,
  ): Promise<{ corolla: string; clio: string }> {
    const email = e2eEmail(tag);
    await seedUser(email, PASSWORD);
    let ids = { corolla: "", clio: "" };
    if (alerts) {
      const [corolla, clio] = await seedAlerts(email, [
        {
          label: "Corolla híbrido",
          criteria: {
            brand: "Toyota",
            model: "Corolla",
            maxPrice: 18000,
            latitude: 40.4168,
            longitude: -3.7038,
            distanceInKm: 50,
          },
          placeName: "Madrid",
          createdAt: new Date("2026-10-02T10:00:00Z"),
        },
        {
          label: "Clio barato",
          criteria: {
            brand: "Renault",
            model: "Clio",
            maxPrice: 9000,
            latitude: 40.4168,
            longitude: -3.7038,
            distanceInKm: 50,
          },
          createdAt: new Date("2026-09-21T10:00:00Z"),
        },
      ]);
      await seedAlertMatches(corolla, [
        {
          ...MATCH_AT_MADRID,
          listingId: "wallapop-a11y-alert-1",
          createdAt: new Date("2026-10-14T10:00:00Z"),
        },
        {
          ...MATCH_AT_MADRID,
          listingId: "wallapop-a11y-alert-2",
          title: "Toyota Corolla Touring Sports",
          price: 17200,
          createdAt: new Date("2026-10-14T09:00:00Z"),
        },
      ]);
      ids = { corolla, clio };
    }
    await page.setViewportSize(viewport);
    await signIn(page, email, PASSWORD);
    return ids;
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const withAlerts of [true, false]) {
      dbTest(
        `ALERTUI-43: no serious accessibility violations on /alerts at ${viewport.width}×${viewport.height}, ${withAlerts ? "with alerts" : "with none"}`,
        async ({ page }) => {
          await openWithAlerts(
            page,
            `a11y-alerts-${viewport.width}-${withAlerts}`,
            viewport,
            withAlerts,
          );

          await page.goto("/alerts");
          await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible({
            timeout: 15_000,
          });
          if (withAlerts) await expect(page.getByText("Corolla híbrido").first()).toBeVisible();
          else await expect(page.getByText("Crea una")).toBeVisible();
          expectNoSeriousViolations(await seriousViolations(page));
        },
      );
    }

    for (const which of ["corolla", "clio"] as const) {
      dbTest(
        `ALERTUI-43: no serious accessibility violations on /alerts/[id] at ${viewport.width}×${viewport.height}, ${which === "corolla" ? "with matches" : "with none"}, and with the confirmation open`,
        async ({ page }) => {
          const ids = await openWithAlerts(
            page,
            `a11y-alert-${viewport.width}-${which}`,
            viewport,
            true,
          );

          await page.goto(`/alerts/${ids[which]}`);
          const name = which === "corolla" ? "Corolla híbrido" : "Clio barato";
          await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
            timeout: 15_000,
          });
          expectNoSeriousViolations(await seriousViolations(page));

          await page.getByRole("button", { name: "Eliminar alerta" }).click();
          await expect(
            page.getByRole("alertdialog", { name: `¿Eliminar «${name}»?` }),
          ).toBeVisible();
          expectNoSeriousViolations(await seriousViolations(page));
        },
      );
    }
  }
});
