import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { E2E_FALLBACK_SECRET } from "../../playwright.config";

// Signing in through the real form, as e2e/saved.spec.ts and
// e2e/alerts-ui.spec.ts do before every DB-backed flow.

/** Signs in through /login with `email` and `password`, and waits to leave it. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/**
 * Waits until `useSession()` has resolved, so the hearts are operable: a press
 * while the session loads is ignored on purpose (FAV-18). The signed-in link to
 * /favorites (the header's on desktop, the tab bar's on a phone) is the
 * hydration signal, as in e2e/favorites.spec.ts.
 */
export async function waitForSession(page: Page) {
  await expect(page.locator('a[href="/favorites"]').filter({ visible: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

// E2E_FALLBACK_SECRET is playwright.config.ts's own fallback, which the DB
// run's server takes when `.env` sets no BETTER_AUTH_SECRET: the cookie must
// be signed with the secret that server verifies it with.

/**
 * Better Auth's session cookie for `token`, as its server sets it over http
 * (lib/auth/auth.ts uses the default `better-auth` prefix, and the e2e server
 * is http://localhost, so no `__Secure-`): the token, a dot, and the base64
 * HMAC-SHA256 of the token under the server's secret, URI-encoded.
 */
function signedSessionCookie(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? E2E_FALLBACK_SECRET;
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

/**
 * Signs the browser in with a session row the test wrote itself
 * (db.ts's seedGoogleOnlySession): for an account with no password, which
 * the /login form cannot sign in. No auth configuration is involved — this is
 * the cookie Better Auth sets after any sign-in, for a session it then looks
 * up in Postgres like any other.
 */
export async function signInWithSessionToken(page: Page, token: string) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("signInWithSessionToken needs the project's baseURL");
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: signedSessionCookie(token),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
