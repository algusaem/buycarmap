import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  e2eEmail,
  seedGoogleOnlySession,
  seedUser,
  type SeedSession,
  seedSessions,
} from "./fixtures/db";
import { deriveCodeForStep, stepForTime } from "../test/two-factor-totp";
import { dragDown, sheetOffset } from "./fixtures/drag";
import { box, expectWithin, hitArea } from "./fixtures/measure";
import { signIn, signInWithSessionToken } from "./fixtures/session";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// docs/specs/redesign-pages.md (PAGES-28, PAGES-39, PAGES-58, PAGES-59): what
// only a browser can show on /account — the grid by viewport, dragging the
// phone sheets down, axe with the dialogs open, and the 44×44px touch
// targets at phone width. All four need a signed-in account, which this
// suite only has against a real database (Contracts › Tests), so every case
// runs in `pnpm test:e2e:db` (E2E_DB) and is skipped elsewhere, like
// e2e/saved.spec.ts and e2e/alerts-ui.spec.ts.
const dbTest = process.env.E2E_DB ? test : test.skip;

// The spec quotes the Spanish copy, the default locale.
test.use({ locale: "es-ES" });

// Clears all three password layers (length, strength, breach corpus) —
// duplicated from auth.spec.ts/saved.spec.ts, per their convention.
const PASSWORD = "harbour-lentil-quilt-97";

const DESKTOP_1440 = { width: 1440, height: 900 };
const DESKTOP_1024 = { width: 1024, height: 900 };
const PHONE_390 = { width: 390, height: 844 };

/**
 * /account's loading state already draws the «Cuenta» heading: wait for the
 * cards («Eliminar cuenta» is on every account) and the fonts, so nothing is
 * measured while the page still lays out.
 */
async function accountLoaded(page: Page): Promise<void> {
  await expect(page.getByRole("region", { name: "Eliminar cuenta" })).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

/** A fresh password account, signed in, on /account at `viewport`. */
async function openAccount(
  page: Page,
  tag: string,
  viewport: { width: number; height: number },
  sessions: SeedSession[] = [],
): Promise<string> {
  const email = e2eEmail(tag);
  await seedUser(email, PASSWORD);
  if (sessions.length > 0) await seedSessions(email, sessions);
  await page.setViewportSize(viewport);
  await signIn(page, email, PASSWORD);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible({
    timeout: 15_000,
  });
  await accountLoaded(page);
  return email;
}

/**
 * A fresh Google-only account (no password), signed in with a session row
 * seeded beside it, since the /login form cannot sign in an account with no
 * password and Google itself cannot run here (e2e/fixtures/db.ts's
 * seedGoogleOnlySession), on /account at `viewport`.
 */
async function openGoogleOnlyAccount(
  page: Page,
  tag: string,
  viewport: { width: number; height: number },
): Promise<void> {
  const token = await seedGoogleOnlySession(e2eEmail(tag));
  await page.setViewportSize(viewport);
  await signInWithSessionToken(page, token);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible({
    timeout: 15_000,
  });
  await accountLoaded(page);
}

/** axe over the whole page once `dialog` has finished fading in, serious and critical only. */
async function expectDialogPassesAxe(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog).toBeVisible();
  // axe reads colours through the dialog's entry fade: wait for it to end.
  await expect(dialog).toHaveCSS("opacity", "1");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

/** «Activar» through to the codes dialog: the password, then a real code from the shown key. */
async function openRecoveryCodes(page: Page) {
  await page
    .getByRole("region", { name: "Dos pasos" })
    .getByRole("button", { name: "Activar" })
    .click();
  await page.locator("#two-factor-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Configurar dos pasos" }).click();
  const key = page.locator("#two-factor-secret");
  await expect(key).toBeVisible({ timeout: 15_000 });
  const secret = (await key.inputValue()).trim();
  await page
    .getByLabel("Introduce el código de 6 dígitos")
    .fill(deriveCodeForStep(secret, stepForTime(Date.now())));
  await page.getByRole("button", { name: "Activar dos pasos" }).click();
  return page.getByRole("alertdialog", { name: "Guarda tus códigos de recuperación" });
}

test.describe("PAGES-28: the grid by viewport", () => {
  dbTest(
    "PAGES-28: at 1440×900, three columns 20px apart inside 32px side padding, the cards of one row equally tall, and «Eliminar cuenta» across two columns",
    async ({ page }) => {
      await openAccount(page, "pages28-1440", DESKTOP_1440);

      // The page's own cards: `main` leaves out the toaster's region.
      const cards = page.locator("main").getByRole("region");
      const count = await cards.count();
      expect(count, "eight cards for a password account").toBe(8);

      const first = await box(cards.nth(0));
      const second = await box(cards.nth(1));
      expectWithin(second.x - (first.x + first.width), 20, "gap between the first row's cards");
      expectWithin(first.y, second.y, "the first row's cards share a top edge");
      expectWithin(first.height, second.height, "the first row's cards are equally tall");
      // The worked example's widths: 32px sides, (1440 − 64 − 40) / 3 = 445.33.
      expectWithin(first.x, 32, "the first card's left edge");
      expectWithin(first.width, 445.33, "a card's width at 1440px");

      const deleteCard = page.getByRole("region", { name: "Eliminar cuenta" });
      const deleteBox = await box(deleteCard);
      expectWithin(deleteBox.width, 910.67, "«Eliminar cuenta» spans two columns");
    },
  );

  dbTest("PAGES-28: at 1024×900, the same three-column grid, narrower", async ({ page }) => {
    await openAccount(page, "pages28-1024", DESKTOP_1024);

    // The page's own cards: `main` leaves out the toaster's region.
    const cards = page.locator("main").getByRole("region");
    const first = await box(cards.nth(0));
    const second = await box(cards.nth(1));
    expectWithin(
      second.x - (first.x + first.width),
      20,
      "gap between the first row's cards at 1024px",
    );
    // (1024 − 64 − 40) / 3 = 306.67, and 306.67 × 2 + 20 = 633.33.
    expectWithin(first.x, 32, "the first card's left edge at 1024px");
    expectWithin(first.width, 306.67, "a card's width at 1024px");
    const deleteBox = await box(page.getByRole("region", { name: "Eliminar cuenta" }));
    expectWithin(deleteBox.width, 633.33, "«Eliminar cuenta» spans two columns at 1024px");
  });

  dbTest("PAGES-28: at 390×844, one column with 12px between cards", async ({ page }) => {
    await openAccount(page, "pages28-390", PHONE_390);

    // The page's own cards: `main` leaves out the toaster's region.
    const cards = page.locator("main").getByRole("region");
    const first = await box(cards.nth(0));
    const second = await box(cards.nth(1));
    expectWithin(first.x, second.x, "one column: every card shares a left edge");
    expectWithin(second.y - (first.y + first.height), 12, "12px between stacked cards");
  });

  dbTest(
    "PAGES-28: with no password, «Eliminar cuenta» takes the one column left and the grid closes in two rows",
    async ({ page }) => {
      await openGoogleOnlyAccount(page, "pages28-google", DESKTOP_1440);

      // The page's own cards: `main` leaves out the toaster's region.
      const cards = page.locator("main").getByRole("region");
      await expect(page.getByRole("region", { name: "Contraseña" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Dos pasos" })).toHaveCount(0);

      const count = await cards.count();
      // Six: the eight minus «Contraseña» and «Dos pasos» (corrected 2026-10-16,
      // confirmed by the owner).
      expect(count, "six cards for a Google-only account").toBe(6);
      const tops = new Set<number>();
      for (let index = 0; index < count; index++) {
        tops.add(Math.round((await box(cards.nth(index))).y));
      }
      expect(tops.size, "the grid closes in two rows").toBe(2);

      const deleteBox = await box(page.getByRole("region", { name: "Eliminar cuenta" }));
      const single = await box(cards.nth(1));
      expectWithin(deleteBox.width, single.width, "«Eliminar cuenta» spans one column");
    },
  );
});

test.describe("PAGES-39: the account sheets close by dragging down, at 390×844", () => {
  dbTest(
    "PAGES-39: dragging the handle down more than 100px closes the sheet",
    async ({ page }) => {
      await openAccount(page, "pages39-close", PHONE_390);
      await page.getByRole("button", { name: "Cambiar nombre" }).click();
      const sheet = page.getByRole("dialog", { name: "Cambiar nombre" });
      await expect(sheet).toBeVisible();
      await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);

      await dragDown(page, sheet.locator("[data-sheet-handle]"), 150);

      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  );

  dbTest("PAGES-39: a slow 40px drag of the handle springs the sheet back", async ({ page }) => {
    await openAccount(page, "pages39-spring", PHONE_390);
    await page.getByRole("button", { name: "Cambiar nombre" }).click();
    const sheet = page.getByRole("dialog", { name: "Cambiar nombre" });
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);

    await dragDown(page, sheet.locator("[data-sheet-handle]"), 40, { hold: true });
    expectWithin(await sheetOffset(sheet), 40, "the sheet mid-drag");
    await page.mouse.up();

    await expect.poll(() => sheetOffset(sheet)).toBeLessThan(0.5);
    await expect(sheet).toBeVisible();
  });
});

test.describe("PAGES-58: /account passes axe with the dialogs open", () => {
  dbTest("PAGES-58: at 1440×900, populated, with no dialog open", async ({ page }) => {
    await openAccount(page, "pages58-1440", DESKTOP_1440, [
      { userAgent: "Chrome/120 Windows", updatedAt: new Date() },
    ]);

    const { violations } = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  dbTest("PAGES-58: at 390×844, populated, with no dialog open", async ({ page }) => {
    await openAccount(page, "pages58-390", PHONE_390, [
      { userAgent: "Chrome/120 Windows", updatedAt: new Date() },
    ]);
    // The tab bar fades in once the session resolves.
    await expect(page.getByTestId("bottom-nav")).toHaveCSS("opacity", "1");

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  dbTest("PAGES-58: at 1440×900, with «Cambiar correo» open", async ({ page }) => {
    await openAccount(page, "pages58-email-1440", DESKTOP_1440);
    await page.getByRole("button", { name: "Cambiar correo" }).click();

    await expectDialogPassesAxe(page, page.getByRole("dialog", { name: "Cambiar correo" }));
  });

  dbTest("PAGES-58: at 390×844, with the deletion confirmation open", async ({ page }) => {
    await openAccount(page, "pages58-delete-390", PHONE_390);
    await expect(page.getByTestId("bottom-nav")).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();

    await expectDialogPassesAxe(
      page,
      page.getByRole("alertdialog", { name: "¿Eliminar tu cuenta?" }),
    );
  });

  for (const [label, viewport] of [
    ["1440×900", DESKTOP_1440],
    ["390×844", PHONE_390],
  ] as const) {
    dbTest(`PAGES-58: at ${label}, with the codes dialog open`, async ({ page }) => {
      await openAccount(page, `pages58-codes-${viewport.width}`, viewport);
      if (viewport === PHONE_390) {
        await expect(page.getByTestId("bottom-nav")).toHaveCSS("opacity", "1");
      }

      const codes = await openRecoveryCodes(page);

      await expectDialogPassesAxe(page, codes);
    });
  }

  dbTest("PAGES-58: at 390×844, with «Cambiar correo» open", async ({ page }) => {
    await openAccount(page, "pages58-email", PHONE_390);
    await page.getByRole("button", { name: "Cambiar correo" }).click();
    await expect(page.getByRole("dialog", { name: "Cambiar correo" })).toBeVisible();
    // axe reads colours through the dialog's entry fade: wait for it to end.
    await expect(page.getByRole("dialog", { name: "Cambiar correo" })).toHaveCSS("opacity", "1");
    // The scan takes the whole page: the tab bar fades in once the session
    // resolves, so wait for that fade to end too.
    await expect(page.getByTestId("bottom-nav")).toHaveCSS("opacity", "1");

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  dbTest("PAGES-58: at 1440×900, with the deletion confirmation open", async ({ page }) => {
    await openAccount(page, "pages58-delete", DESKTOP_1440);
    await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
    await expect(page.getByRole("alertdialog", { name: "¿Eliminar tu cuenta?" })).toBeVisible();
    // axe reads colours through the dialog's entry fade: wait for it to end.
    await expect(page.getByRole("alertdialog", { name: "¿Eliminar tu cuenta?" })).toHaveCSS(
      "opacity",
      "1",
    );

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  for (const [label, viewport] of [
    ["1440×900", DESKTOP_1440],
    ["390×844", PHONE_390],
  ] as const) {
    dbTest(`PAGES-58: at ${label}, a Google-only account`, async ({ page }) => {
      await openGoogleOnlyAccount(page, `pages58-google-${viewport.width}`, viewport);

      const { violations } = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  }
});

test.describe("PAGES-59: every control of /account has a hit area of at least 44×44px, at 390×844", () => {
  dbTest(
    "PAGES-59: each card's button, «Cambiar correo» as a text button, and «Cerrar sesión»",
    async ({ page }) => {
      await openAccount(page, "pages59-cards", PHONE_390);

      const targets: [string, ReturnType<Page["getByRole"]>][] = [
        ["«Cambiar nombre»", page.getByRole("button", { name: "Cambiar nombre" })],
        ["«Cambiar correo»", page.getByRole("button", { name: "Cambiar correo" })],
        ["«Cambiar contraseña»", page.getByRole("button", { name: "Cambiar contraseña" })],
        ["«Activar»", page.getByRole("button", { name: "Activar" })],
        ["«Descargar mis datos»", page.getByRole("button", { name: "Descargar mis datos" })],
        ["«Eliminar mi cuenta»", page.getByRole("button", { name: "Eliminar mi cuenta" })],
        ["«Cerrar sesión»", page.getByRole("button", { name: "Cerrar sesión" })],
      ];

      for (const [label, target] of targets) {
        const size = await hitArea(target);
        expect(
          size.width >= 44 && size.height >= 44,
          `${label} is ${size.width}x${size.height}, under the 44px floor`,
        ).toBe(true);
      }
    },
  );

  dbTest(
    "PAGES-59: every control inside the «Cambiar contraseña» sheet, «Cancelar» included",
    async ({ page }) => {
      await openAccount(page, "pages59-sheet", PHONE_390);
      await page.getByRole("button", { name: "Cambiar contraseña" }).click();
      const sheet = page.getByRole("dialog", { name: "Cambiar contraseña" });
      await expect(sheet).toBeVisible();

      const eyes = sheet.getByRole("button", { name: "Mostrar contraseña" });
      await expect(eyes).toHaveCount(3);
      const targets: [string, ReturnType<Page["getByRole"]>][] = [
        ["the «Contraseña actual» eye", eyes.nth(0)],
        ["the «Nueva contraseña» eye", eyes.nth(1)],
        ["the «Repite la contraseña» eye", eyes.nth(2)],
        ["«Guardar contraseña»", sheet.getByRole("button", { name: "Guardar contraseña" })],
        ["«Cancelar»", sheet.getByRole("button", { name: "Cancelar" })],
      ];

      for (const [label, target] of targets) {
        const size = await hitArea(target);
        expect(
          size.width >= 44 && size.height >= 44,
          `${label} is ${size.width}x${size.height}, under the 44px floor`,
        ).toBe(true);
      }
    },
  );

  dbTest(
    "PAGES-59: every control inside the «Sesiones» sheet, «Cerrar» included",
    async ({ page }) => {
      await openAccount(page, "pages59-sessions", PHONE_390, [
        { userAgent: "Chrome/120 Windows", updatedAt: new Date() },
      ]);
      await page.getByRole("button", { name: "Cerrar las demás" }).first().click();
      const sheet = page.getByRole("dialog", { name: "Sesiones" });
      await expect(sheet).toBeVisible();

      const otherRow = sheet.getByRole("button", { name: /^Cerrar la sesión de / });
      await expect(otherRow).toHaveCount(1);
      const targets: [string, ReturnType<Page["getByRole"]>][] = [
        ["the other session's «Cerrar sesión»", otherRow],
        ["«Cerrar las demás»", sheet.getByRole("button", { name: "Cerrar las demás" })],
        [
          "«Cerrar sesión en todas partes»",
          sheet.getByRole("button", { name: "Cerrar sesión en todas partes" }),
        ],
        ["«Cerrar»", sheet.getByRole("button", { name: "Cerrar", exact: true })],
      ];

      for (const [label, target] of targets) {
        const size = await hitArea(target);
        expect(
          size.width >= 44 && size.height >= 44,
          `${label} is ${size.width}x${size.height}, under the 44px floor`,
        ).toBe(true);
      }
    },
  );
});

// A second password that clears the same three layers as PASSWORD, for the
// change itself. The DB run's server keeps the real breach check
// (lib/auth/pwned.ts, which fails open when the service cannot be reached).
const NEW_PASSWORD = "tangerine-gravel-orbit-41";

/** «Cambiar contraseña» from PASSWORD to NEW_PASSWORD, through to its toast. */
async function changePassword(page: Page) {
  await page
    .getByRole("region", { name: "Contraseña" })
    .getByRole("button", { name: "Cambiar contraseña" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cambiar contraseña" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Contraseña actual").fill(PASSWORD);
  await dialog.getByLabel("Nueva contraseña").fill(NEW_PASSWORD);
  await dialog.getByLabel("Repite la contraseña").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("PAGES-42: a password change keeps this device signed in", () => {
  dbTest(
    "PAGES-42: changing the password keeps this device signed in and ends the other sessions",
    async ({ page }) => {
      await openAccount(page, "pages42-keep", DESKTOP_1440, [
        { userAgent: "Safari/604 iPhone", updatedAt: new Date(Date.now() - 2 * 86_400_000) },
      ]);
      const sessions = page.getByRole("region", { name: "Sesiones" });
      await expect(sessions.getByText("2 abiertas")).toBeVisible();

      await changePassword(page);
      await page.reload();

      await expect(page).toHaveURL(/\/account$/);
      await accountLoaded(page);
      await expect(
        page.getByRole("region", { name: "Sesiones" }).getByText("1 abierta"),
      ).toBeVisible();
    },
  );

  dbTest(
    "PAGES-42: with two-factor on, changing the password keeps this device signed in",
    async ({ page }) => {
      await openAccount(page, "pages42-2fa", DESKTOP_1440);
      const codes = await openRecoveryCodes(page);
      await expect(codes).toBeVisible({ timeout: 15_000 });
      await codes.getByRole("button", { name: "Copiar códigos" }).click();
      await codes.getByRole("button", { name: "Ya los he guardado" }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Dos pasos" }).getByText("Activada"),
      ).toBeVisible();

      await changePassword(page);
      await page.reload();

      await expect(page).toHaveURL(/\/account$/);
      await accountLoaded(page);
      await expect(
        page.getByRole("region", { name: "Dos pasos" }).getByText("Activada"),
      ).toBeVisible();
    },
  );
});

test.describe("PAGES-54, PAGES-55: deleting the account", () => {
  dbTest(
    "PAGES-55: ELIMINAR and the password delete the account, go home with the toast, and /account then asks to sign in",
    async ({ page }) => {
      await openAccount(page, "pages55-delete", DESKTOP_1440);
      await page
        .getByRole("region", { name: "Eliminar cuenta" })
        .getByRole("button", { name: "Eliminar mi cuenta" })
        .click();
      const confirm = page.getByRole("alertdialog", { name: "¿Eliminar tu cuenta?" });
      await expect(confirm).toBeVisible();

      await confirm.getByLabel("Tu contraseña").fill(PASSWORD);
      await confirm.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
      await confirm.getByRole("button", { name: "Eliminar mi cuenta" }).click();

      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
      await expect(page.getByText("Tu cuenta ha sido eliminada")).toBeVisible();
      await page.goto("/account");
      await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)account$/, { timeout: 15_000 });
    },
  );
});

test.describe("PAGES-41: «Cambiar correo»", () => {
  // The e2e server sends no email (playwright.config.ts's NO_EMAIL): the
  // action skips the send and answers as it does with email configured, so
  // only the neutral notice can be checked here.
  dbTest(
    "PAGES-41: a new address and the password give way to the neutral notice",
    async ({ page }) => {
      await openAccount(page, "pages41-email", DESKTOP_1440);
      await page
        .getByRole("region", { name: "Correo" })
        .getByRole("button", { name: "Cambiar correo" })
        .click();
      const dialog = page.getByRole("dialog", { name: "Cambiar correo" });
      await expect(dialog).toBeVisible();

      await dialog.getByLabel("Nueva dirección de correo").fill(e2eEmail("pages41-new"));
      await dialog.getByLabel("Contraseña actual").fill(PASSWORD);
      await dialog.getByRole("button", { name: "Cambiar correo" }).click();

      await expect(
        dialog.getByText(
          "Si esa dirección está disponible, le hemos enviado un enlace de confirmación. El cambio se aplica cuando lo pulses allí.",
        ),
      ).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
    },
  );
});
