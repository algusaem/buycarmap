import { test, expect, Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, seedUser, userExists } from "./fixtures/db";

// The app defaults to Spanish, so every user-facing matcher accepts EN or ES.
const SIGN_IN = /sign in|entrar/i;
const SIGN_UP = /sign up|registr|crear/i;
const SIGN_OUT = /sign out|cerrar sesi/i;

// Real register/login persist to a database. They run only with E2E_DB=1 (and a
// real DATABASE_URL); the global teardown then deletes every seeded account.
const dbTest = process.env.E2E_DB ? test : test.skip;

const PASSWORD = "Password123!";

// Scope auth controls to the navbar: the home Hero also has a "Sign in to save
// searches" CTA, so an unscoped sign-in matcher would catch that too.
function navSignIn(page: Page) {
  return page.getByRole("navigation").getByRole("link", { name: SIGN_IN });
}
function signOutButton(page: Page) {
  return page.getByRole("navigation").getByRole("button", { name: SIGN_OUT });
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
  test("home shows signed-out controls, not a session", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await expect(navSignIn(page)).toBeVisible();
    await expect(signOutButton(page)).toHaveCount(0);

    // Sign up is hidden on narrow viewports (hidden sm:inline-flex), shown wider.
    const signUp = page
      .getByRole("navigation")
      .getByRole("link", { name: SIGN_UP });
    if (isMobile) {
      await expect(signUp).toBeHidden();
    } else {
      await expect(signUp).toBeVisible();
    }
  });

  test("the map is fully usable without an account", async ({ page }) => {
    await mockListingSources(page);
    await page.goto("/map");

    // Listings render for an anonymous visitor...
    await expect(page.getByText("Audi A3 2.0 TDI", { exact: false })).toBeVisible();
    // ...and the navbar still offers sign-in rather than a session.
    await expect(navSignIn(page)).toBeVisible();
    await expect(signOutButton(page)).toHaveCount(0);
  });
});

test.describe("client-side validation", () => {
  test("login shows a required-field error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: SIGN_IN }).click();
    await expect(
      page.getByText(/required|obligatorio|requerido/i).first()
    ).toBeVisible();
  });

  test("register blocks mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/email|correo/i).fill("ada@example.com");
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill("longenough");
    await passwords.nth(1).fill("different");
    await page.getByRole("button", { name: SIGN_UP }).click();
    await expect(page.getByText(/do not match|no coinciden/i)).toBeVisible();
  });

  test("register blocks a too-short password", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/email|correo/i).fill("ada@example.com");
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill("short");
    await passwords.nth(1).fill("short");
    await page.getByRole("button", { name: SIGN_UP }).click();
    await expect(
      page.getByText(/at least 8 characters|al menos 8/i)
    ).toBeVisible();
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

  dbTest("register signs the user in, persists across reload, and signs out", async ({
    page,
  }) => {
    const email = e2eEmail("register");

    await registerViaUi(page, email);

    // Auto sign-in after registration → session-driven navbar.
    await expect(signOutButton(page)).toBeVisible({ timeout: 15_000 });
    await expect(navSignIn(page)).toHaveCount(0);
    await expect(page.getByText("E2E User")).toBeVisible();

    // The account was actually written to the database.
    expect(await userExists(email)).toBe(true);

    // Session survives a full reload (JWT cookie).
    await page.reload();
    await expect(signOutButton(page)).toBeVisible();

    // Sign out returns to the anonymous state.
    await signOutButton(page).click();
    await expect(navSignIn(page)).toBeVisible({ timeout: 15_000 });
    await expect(signOutButton(page)).toHaveCount(0);
  });

  dbTest("an existing account can log in", async ({ page }) => {
    const email = e2eEmail("login");
    await seedUser(email, PASSWORD);

    await loginViaUi(page, email, PASSWORD);

    await expect(signOutButton(page)).toBeVisible({ timeout: 15_000 });
    await expect(navSignIn(page)).toHaveCount(0);
  });

  dbTest("a wrong password is rejected and no session is created", async ({
    page,
  }) => {
    const email = e2eEmail("wrongpw");
    await seedUser(email, PASSWORD);

    await loginViaUi(page, email, "not-the-password");

    await expect(
      page.getByText(/invalid email or password|incorrect/i)
    ).toBeVisible();
    await expect(signOutButton(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  dbTest("registering a duplicate email is rejected", async ({ page }) => {
    const email = e2eEmail("dupe");
    await seedUser(email, PASSWORD);

    await registerViaUi(page, email);

    await expect(page.getByText(/already exists/i)).toBeVisible();
    await expect(signOutButton(page)).toHaveCount(0);
  });
});
