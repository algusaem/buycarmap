import { test, expect } from "@playwright/test";

test.describe("login", () => {
  test("shows a required-field error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in|iniciar/i }).click();
    await expect(page.getByText(/required|obligatorio|requerido/i).first()).toBeVisible();
  });
});

test.describe("register", () => {
  test("blocks submission when passwords do not match", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel(/email/i).fill("ada@example.com");
    // Two password fields: password then confirm.
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill("longenough");
    await passwords.nth(1).fill("different");
    await page.getByRole("button", { name: /sign up|crear|registr/i }).click();

    await expect(page.getByText(/do not match|no coinciden/i)).toBeVisible();
  });
});

// Full register → login persistence round-trip. Requires a real test database
// (Postgres/Prisma), which is deferred to the DB iteration. Flip to `test`
// once a disposable DB + migrations are wired into the e2e setup.
test.skip("register then login persists the account", async () => {
  // 1. Register a unique email.
  // 2. Assert redirect to home / authenticated state.
  // 3. Log out, log back in with the same credentials.
  // 4. Assert authenticated.
});
