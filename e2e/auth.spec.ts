import { test, expect, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser, userExists } from "./fixtures/db";

// The app defaults to Spanish, so every user-facing matcher accepts EN or ES.
const SIGN_IN = /sign in|entrar/i;
const SIGN_UP = /sign up|registr|crear/i;
const SIGN_OUT = /sign out|cerrar sesi/i;
// lib/i18n/locales/en.ts nav.favorites: "Saved cars"; es.ts: "Coches guardados".
const SAVED_CARS = /saved cars|coches guardados/i;

// Real register/login persist to a database. They run only with E2E_DB=1 (and a
// real DATABASE_URL); the global teardown then deletes every seeded account.
const dbTest = process.env.E2E_DB ? test : test.skip;

// Must clear all three policy layers: 12+ characters, a strength score of at
// least 2, and absence from the HIBP breach corpus (which the server really
// queries). "Password123!" would fail — it canonicalizes to the blocklisted
// "password" once the trailing decoration is stripped.
const PASSWORD = "harbour-lentil-quilt-97";

// Scope auth controls to the navbar: the home Hero also has a "Sign in to save
// searches" CTA, so an unscoped sign-in matcher would catch that too.
function navSignIn(page: Page) {
  return page.getByRole("navigation").getByRole("link", { name: SIGN_IN });
}
function navSavedCars(page: Page) {
  return page.getByRole("navigation").getByRole("link", { name: SAVED_CARS });
}

/**
 * The account dropdown's trigger, named after the signed-in user — desktop
 * sign-out is a menuitem inside it, hidden until it is opened.
 */
function accountTrigger(page: Page, name: string) {
  return page.getByRole("navigation").getByRole("button", { name });
}

async function signOut(page: Page, name: string) {
  await accountTrigger(page, name).click();
  // Waiting on the URL alone is not enough: a sign-in that landed on "/"
  // leaves the browser already there, so a later `waitForURL("/")` after
  // signing out would resolve on the spot rather than on the redirect this
  // click causes, racing the POST that actually clears the session cookie —
  // middleware then still sees a token and bounces the next /login straight
  // back. Waiting for that POST's response is the one signal that is true
  // regardless of which URL the page started from.
  const signedOut = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/signout") && response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: SIGN_OUT }).click();
  await signedOut;
}

/**
 * Asserts the navbar is offering a visitor a way in and no session controls.
 *
 * Viewport-aware since the navbar restructure (docs/specs/navbar.md): below the
 * `lg` breakpoint sign-in lives inside the collapsed menu, so looking for it in
 * the bar finds nothing on a phone. The saved-cars link is checked at count 0
 * rather than hidden — signed out, it is not rendered anywhere, menu included.
 */
async function expectSignedOut(page: Page, isMobile: boolean) {
  await expect(navSavedCars(page)).toHaveCount(0);

  if (!isMobile) {
    await expect(navSignIn(page)).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: /^(menu|menú)$/i }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: SIGN_IN })).toBeVisible();
}

async function registerViaUi(page: Page, email: string, name = "E2E User") {
  await page.goto("/register");
  await page.getByLabel(/name|nombre/i).fill(name);
  await page.getByLabel(/email|correo/i).fill(email);
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill(PASSWORD);
  await passwords.nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: SIGN_UP }).click();
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: SIGN_IN }).click();
}

// ---------------------------------------------------------------------------
// Always-on: no database required. Auth is optional — the app must work fully
// while logged out, and client-side validation must block bad input.
// ---------------------------------------------------------------------------

test.describe("logged-out experience (auth is optional)", () => {
  test("home shows signed-out controls, not a session", async ({ page, isMobile }) => {
    await page.goto("/");

    // Sign up is visible at every width. This assertion used to say the
    // opposite on mobile — `hidden sm:inline-flex` meant the register link was
    // absent on phones, and the test recorded that as intended. NAV-17 in
    // docs/specs/navbar.md decided it was a defect: it is the product's primary
    // conversion action and it was missing on the devices most people arrive on.
    //
    // Checked before expectSignedOut, which opens the menu on a phone and puts
    // an overlay over the bar this is looking at.
    await expect(page.getByRole("navigation").getByRole("link", { name: SIGN_UP })).toBeVisible();

    await expectSignedOut(page, isMobile);
  });

  test("the map is fully usable without an account", async ({ page, isMobile }) => {
    await mockListingSources(page);
    await page.goto("/map");

    // Listings render for an anonymous visitor...
    await expect(page.getByText("Audi A3 2.0 TDI", { exact: false })).toBeVisible();
    // ...and the navbar still offers sign-in rather than a session.
    await expectSignedOut(page, isMobile);
  });
});

test.describe("client-side validation", () => {
  test("login shows a required-field error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: SIGN_IN }).click();
    await expect(page.getByText(/required|obligatorio|requerido/i).first()).toBeVisible();
  });

  test("register blocks mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/email|correo/i).fill("ada@example.com");
    const passwords = page.locator('input[type="password"]');
    // Both long enough, so the mismatch is the only thing left to fail on —
    // a short password would trip the length rule first and never reach the
    // cross-field check.
    await passwords.nth(0).fill(PASSWORD);
    await passwords.nth(1).fill("a-different-passphrase");
    await page.getByRole("button", { name: SIGN_UP }).click();
    await expect(page.getByText(/do not match|no coinciden/i)).toBeVisible();
  });

  test("register blocks a too-short password", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/email|correo/i).fill("ada@example.com");
    const passwords = page.locator('input[type="password"]');
    // 11 characters — one below the floor.
    await passwords.nth(0).fill("abcdefghijk");
    await passwords.nth(1).fill("abcdefghijk");
    await page.getByRole("button", { name: SIGN_UP }).click();
    // Two elements say this: the field's validation error and the strength
    // meter's issue hint. Either one proves the floor is enforced in the UI.
    await expect(page.getByText(/at least 12 characters|al menos 12/i).first()).toBeVisible();
  });

  test("the strength meter rates passwords as the user types", async ({ page }) => {
    await page.goto("/register");
    const password = page.locator('input[type="password"]').nth(0);

    await password.fill("password");
    await expect(page.getByText(/very weak|muy débil/i)).toBeVisible();

    await password.fill(PASSWORD);
    await expect(page.getByText(/strong|muy segura/i)).toBeVisible();
  });

  test("reset-password without a token offers a way forward", async ({ page }) => {
    await page.goto("/reset-password");

    // No dead ends: the page must route the user to a fresh link.
    await expect(page.getByText(/no longer valid|ya no es válido/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /request a new link|solicitar un enlace/i }),
    ).toBeVisible();
  });

  test("verify-email without a token offers a way forward", async ({ page }) => {
    await page.goto("/verify-email");

    await expect(page.getByText(/no longer valid|ya no es válido/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to sign up|volver al registro/i }),
    ).toBeVisible();
  });

  test("confirm-email without a token offers a way forward", async ({ page }) => {
    await page.goto("/confirm-email");

    await expect(page.getByText(/no longer valid|ya no es válido/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to your account|volver a tu cuenta/i }),
    ).toBeVisible();
  });

  test("the two-factor code field stays hidden until it is needed", async ({ page }) => {
    await page.goto("/login");

    // Showing it up front would tell every visitor which accounts use 2FA,
    // and confuse the ones that do not.
    await expect(page.getByLabel(/enter the 6-digit code|codigo de 6|código de 6/i)).toHaveCount(0);
    await expect(page.getByLabel(/password|contraseña/i).first()).toBeVisible();
  });

  test("signed-out visitors are redirected away from /account", async ({ page }) => {
    await page.goto("/account");

    await expect(page).toHaveURL(/\/login/);
    // The intended destination is preserved so sign-in can return there.
    expect(page.url()).toContain("callbackUrl");
  });
});

// ---------------------------------------------------------------------------
// DB-gated: real persistence against Neon (E2E_DB=1). Teardown cleans up.
// ---------------------------------------------------------------------------

test.describe("authenticated flows (real database)", () => {
  // Real persistence is exercised once, on desktop. Running it on the mobile
  // project too would just double the writes to the shared database.
  test.beforeEach(({ isMobile }) => {
    test.skip(!!isMobile, "DB auth flows run on desktop only");
  });

  dbTest("register signs the user in, persists across reload, and signs out", async ({ page }) => {
    const email = e2eEmail("register");
    const name = "E2E User";

    await registerViaUi(page, email, name);

    // Auto sign-in after registration → session-driven navbar.
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    await expect(navSignIn(page)).toHaveCount(0);
    await expect(page.getByText(name)).toBeVisible();

    // The account was actually written to the database.
    expect(await userExists(email)).toBe(true);

    // Session survives a full reload (JWT cookie).
    await page.reload();
    await expect(navSavedCars(page)).toBeVisible();

    // Sign out returns to the anonymous state.
    await signOut(page, name);
    await expect(navSignIn(page)).toBeVisible({ timeout: 15_000 });
    await expect(navSavedCars(page)).toHaveCount(0);
  });

  dbTest("an existing account can log in", async ({ page }) => {
    const email = e2eEmail("login");
    await seedUser(email, PASSWORD);

    await loginViaUi(page, email, PASSWORD);

    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    await expect(navSignIn(page)).toHaveCount(0);
  });

  dbTest("a wrong password is rejected and no session is created", async ({ page }) => {
    const email = e2eEmail("wrongpw");
    await seedUser(email, PASSWORD);

    await loginViaUi(page, email, "not-the-password");

    await expect(page.getByText(/invalid email or password|incorrect/i)).toBeVisible();
    await expect(navSavedCars(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  dbTest("registering a duplicate email is rejected", async ({ page }) => {
    // Only meaningful in the no-email fallback, which is the mode the e2e
    // server runs in (no RESEND_API_KEY). With email configured, registration
    // is verify-first and this case is indistinguishable from a free address
    // by design — see the enumeration section of the auth spec.
    const email = e2eEmail("dupe");
    await seedUser(email, PASSWORD);

    await registerViaUi(page, email);

    await expect(page.getByText(/already exists|ya existe/i)).toBeVisible();
    await expect(navSavedCars(page)).toHaveCount(0);
  });
});
