import { test, expect, type Page } from "@playwright/test";
import { clearRateLimits, e2eEmail, seedUser } from "./fixtures/db";
import { deriveCode, stepForTime } from "../lib/auth/two-factor/totp";

// The integration the unit tests cannot reach: enrol through the real UI, then
// sign in with a code the authenticator app would have produced. Everything
// here goes through the browser and the real database.
//
// Codes are derived with the same module the server uses. That is not circular:
// `totp.test.ts` pins that module against the published RFC 6238 vectors, so if
// it were wrong those tests would fail first. What this file proves is the
// wiring — that the secret shown on screen is the one stored, encrypted,
// decrypted and verified across two separate requests.

const dbTest = process.env.E2E_DB ? test : test.skip;
const PASSWORD = "harbour-lentil-quilt-97";

const SIGN_IN = /sign in|entrar/i;
const SIGN_OUT = /sign out|cerrar sesi/i;
// messages/en.json nav.favorites: "Saved cars"; messages/es.json: "Coches guardados".
const SAVED_CARS = /saved cars|coches guardados/i;

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
 * A code for the *next* counter step.
 *
 * Enrolment consumes the step of the code that confirmed it, so the same code
 * cannot then be used to sign in — that is the replay guard working, and it is
 * the behaviour a real user meets if they enable 2FA and immediately sign out
 * and back in within the same 30 seconds. Stepping forward one is what waiting
 * for the app's next code amounts to, without sleeping for half a minute. It
 * stays inside the ±1 drift window, so the server accepts it.
 */
function nextCode(secret: string): string {
  return deriveCode(secret, stepForTime(Date.now()) + 1);
}

async function loginViaUi(page: Page, email: string, code?: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: SIGN_IN }).click();

  if (code === undefined) return;

  // The field only exists once the server has reported that a code is needed.
  const field = page.getByLabel(/enter the 6-digit code|código de 6/i);
  await field.waitFor();
  await field.fill(code);
  await page.getByRole("button", { name: SIGN_IN }).click();
}

/** Runs enrolment through the UI and returns the secret and recovery codes. */
async function enrolTwoFactor(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: /set up two-factor|configurar dos pasos/i }).click();

  // The manual-entry key is on screen for anyone who cannot scan — which also
  // makes it the natural way for a test to learn the secret, with no database
  // access and no reliance on internals.
  const secret = (
    await page
      .locator("code")
      .filter({ hasText: /^[A-Z2-7]+$/ })
      .first()
      .innerText()
  ).trim();

  await page
    .getByLabel(/enter the 6-digit code|código de 6/i)
    .fill(deriveCode(secret, stepForTime(Date.now())));
  await page.getByRole("button", { name: /turn on two-factor|activar dos pasos/i }).click();

  await expect(page.getByText(/save your recovery codes|guarda tus códigos/i)).toBeVisible({
    timeout: 15_000,
  });

  const recoveryCodes = await page
    .locator("li")
    .filter({ hasText: /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/ })
    .allInnerTexts();

  await page.getByRole("button", { name: /copy codes|copiar códigos/i }).click();
  await page.getByRole("button", { name: /i've saved them|ya los he guardado/i }).click();

  return { secret, recoveryCodes: recoveryCodes.map((c) => c.trim()) };
}

test.describe("two-factor authentication (real database)", () => {
  test.beforeEach(async ({ isMobile, context }) => {
    test.skip(!!isMobile, "DB flows run on desktop only");
    // The recovery-codes panel copies to the clipboard before it can be
    // dismissed; headless Chromium needs this granted explicitly.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Each test signs in several times; without this the per-IP budget runs
    // out partway through the run and later tests fail for the wrong reason.
    await clearRateLimits();
  });

  dbTest("enrols, then requires a code on the next sign-in", async ({ page }) => {
    const email = e2eEmail("totp");
    const name = "Seeded User";
    await seedUser(email, PASSWORD, name);

    await loginViaUi(page, email);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });

    const { secret } = await enrolTwoFactor(page);
    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    // Password alone is no longer enough.
    await page.goto("/login");
    await page.getByLabel(/email|correo/i).fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: SIGN_IN }).click();

    await expect(page.getByLabel(/enter the 6-digit code|código de 6/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(navSavedCars(page)).toHaveCount(0);

    // With the code, sign-in completes.
    await page.getByLabel(/enter the 6-digit code|código de 6/i).fill(nextCode(secret));
    await page.getByRole("button", { name: SIGN_IN }).click();

    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
  });

  dbTest("rejects a wrong code", async ({ page }) => {
    const email = e2eEmail("totp-wrong");
    const name = "Seeded User";
    await seedUser(email, PASSWORD, name);

    await loginViaUi(page, email);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    await enrolTwoFactor(page);
    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    await loginViaUi(page, email, "000000");

    await expect(page.getByText(/isn't valid|no es válido/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(navSavedCars(page)).toHaveCount(0);
  });

  dbTest("accepts a recovery code, and only once", async ({ page }) => {
    const email = e2eEmail("totp-recovery");
    const name = "Seeded User";
    await seedUser(email, PASSWORD, name);

    await loginViaUi(page, email);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    const { recoveryCodes } = await enrolTwoFactor(page);
    expect(recoveryCodes).toHaveLength(10);

    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    // A recovery code stands in for the authenticator.
    await loginViaUi(page, email, recoveryCodes[0]);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });

    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    // The same code must not work a second time.
    await loginViaUi(page, email, recoveryCodes[0]);
    await expect(page.getByText(/isn't valid|no es válido/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(navSavedCars(page)).toHaveCount(0);
  });

  dbTest("refuses to replay a code that already signed someone in", async ({ page }) => {
    const email = e2eEmail("totp-replay");
    const name = "Seeded User";
    await seedUser(email, PASSWORD, name);

    await loginViaUi(page, email);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    const { secret } = await enrolTwoFactor(page);
    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    const code = nextCode(secret);

    await loginViaUi(page, email, code);
    await expect(navSavedCars(page)).toBeVisible({ timeout: 15_000 });
    await signOut(page, name);
    await expect(navSavedCars(page)).toHaveCount(0, { timeout: 15_000 });

    // Still inside its 30-second window, so it is arithmetically valid — the
    // stored step is what refuses it.
    await loginViaUi(page, email, code);
    await expect(page.getByText(/isn't valid|no es válido/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(navSavedCars(page)).toHaveCount(0);
  });
});
