import { test, expect, Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";
import { e2eEmail, favoriteCount, seedUser } from "./fixtures/db";

// Saving a listing is only meaningful against a real database: the unit tests
// mock Prisma, so "it is still there on the next request" means the action read
// back what it wrote, not that Postgres kept it. This is the round trip.
const dbTest = process.env.E2E_DB ? test : test.skip;

// Clears all three password layers (length, strength, breach corpus).
const PASSWORD = "harbour-lentil-quilt-97";

const FAVORITE = /add to favorites|guardar en favoritos/i;
const UNFAVORITE = /remove from favorites|quitar de favoritos/i;
const AUDI = "Audi A3 2.0 TDI";

// Deliberately duplicated from auth.spec.ts rather than shared: five lines of
// page-object glue, and coupling two spec files together to save them would
// make either harder to change alone.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email|correo/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

function audiCard(page: Page) {
  return page.getByRole("article").filter({ hasText: AUDI });
}

/**
 * Waits until `useSession()` has resolved, so the favorite control is operable.
 *
 * A click while the session is still loading is deliberately ignored (FAV-18),
 * so clicking too early is silently a no-op and the poll below times out. The
 * navbar swapping in the signed-in controls is the same hydration signal
 * `waitForPageToSettle` uses in visual.spec.ts.
 *
 * This matters on `/favorites` and not on `/map`: the favorites page is
 * server-rendered, so the card is clickable on first paint, well before the
 * session request comes back. On the map the cards only exist after the source
 * fetches resolve, which hides the window.
 */
async function waitForSession(page: Page) {
  await expect(page.getByRole("button", { name: /sign out|cerrar sesión/i })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Toggles the Audi card's favorite control and waits for Postgres to agree.
 *
 * The optimistic flip is NOT proof the save landed: the control changes before
 * the request completes and rolls back afterwards if it failed, so asserting on
 * the label alone passes even when nothing was written. That is not
 * hypothetical -- this test first failed exactly that way, navigating away
 * mid-flight and finding an empty favorites page.
 *
 * Waiting on the response was the obvious fix and was worse: a server action
 * POSTs to whatever page you are on, the coches.net proxy is also a POST, and
 * matching the `next-action` header turned out to be unreliable too. Polling
 * the row count is transport-agnostic and asserts the thing the test is
 * actually about.
 */
async function toggleFavorite(page: Page, label: RegExp, email: string, expected: number) {
  await waitForSession(page);
  await audiCard(page).getByRole("button", { name: label }).click();
  await expect.poll(() => favoriteCount(email), { timeout: 15_000 }).toBe(expected);
}

async function openMapWithListings(page: Page) {
  await page.goto("/map");
  await expect(page.getByText(AUDI)).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!!isMobile, "DB favorites flows run on desktop only");
  await mockListingSources(page);
});

test.describe("favorites (real database)", () => {
  dbTest("FAV-1: a saved listing survives a reload and a fresh page load", async ({ page }) => {
    const email = e2eEmail("fav-save");
    await seedUser(email, PASSWORD);
    await signIn(page, email);

    await openMapWithListings(page);
    await toggleFavorite(page, FAVORITE, email, 1);

    // A different page, served from the database rather than component state.
    await page.goto("/favorites");
    await expect(page.getByText(AUDI)).toBeVisible({ timeout: 15_000 });

    // And it is not a client-side cache: a full reload re-reads Postgres.
    await page.reload();
    await expect(page.getByText(AUDI)).toBeVisible({ timeout: 15_000 });
  });

  dbTest("FAV-16: a saved car still looks saved when the search runs again", async ({ page }) => {
    const email = e2eEmail("fav-reconcile");
    await seedUser(email, PASSWORD);
    await signIn(page, email);

    await openMapWithListings(page);
    await toggleFavorite(page, FAVORITE, email, 1);

    // The whole point: results come back from the sources knowing nothing about
    // this user, so a fresh search has to be reconciled against what they saved.
    await page.goto("/map");
    await expect(page.getByText(AUDI)).toBeVisible({ timeout: 15_000 });
    await expect(audiCard(page).getByRole("button", { name: UNFAVORITE })).toBeVisible({
      timeout: 15_000,
    });
  });

  dbTest("FAV-3: unsaving a listing removes it from the favorites page", async ({ page }) => {
    const email = e2eEmail("fav-remove");
    await seedUser(email, PASSWORD);
    await signIn(page, email);

    await openMapWithListings(page);
    await toggleFavorite(page, FAVORITE, email, 1);

    await page.goto("/favorites");
    await expect(page.getByText(AUDI)).toBeVisible({ timeout: 15_000 });
    await toggleFavorite(page, UNFAVORITE, email, 0);

    await page.goto("/favorites");
    await expect(page.getByText(AUDI)).toHaveCount(0);
    // The empty state, not a broken grid.
    await expect(page.getByRole("link", { name: /search for cars|buscar coches/i })).toBeVisible();
  });

  dbTest("FAV-8: one user never sees another user's saved listings", async ({ page }) => {
    const owner = e2eEmail("fav-owner");
    const other = e2eEmail("fav-other");
    await seedUser(owner, PASSWORD);
    await seedUser(other, PASSWORD);

    await signIn(page, owner);
    await openMapWithListings(page);
    await toggleFavorite(page, FAVORITE, owner, 1);

    // Sign out by clearing the session cookie, then in as the other account.
    await page.context().clearCookies();
    await signIn(page, other);

    await page.goto("/favorites");
    await expect(page.getByText(AUDI)).toHaveCount(0);
  });
});
