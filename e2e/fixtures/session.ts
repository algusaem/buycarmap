import { expect, type Page } from "@playwright/test";

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
