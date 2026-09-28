import { test, expect, type Page } from "@playwright/test";
import { mockListingSources } from "./fixtures/network";

// lib/geo/nominatim.ts calls this endpoint directly from the browser (it is a
// public API with its own CORS policy, unlike Wallapop/coches.net/Milanuncios,
// which go through app/api/<source> — see CLAUDE.md "Upstream sources").
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search**";

const MADRID_RESULT = {
  place_id: 1,
  display_name: "Madrid, Comunidad de Madrid, España",
  lat: "40.4168",
  lon: "-3.7038",
  address: { city: "Madrid", state: "Comunidad de Madrid" },
};

const FILTERS_BUTTON = /filters|filtros/i;
const LOCATION_PLACEHOLDER = /city or address|ciudad o dirección/i;

async function openLocationSearch(page: Page) {
  await page.goto("/map");
  await page.getByRole("button", { name: FILTERS_BUTTON }).first().click();
  return page.getByPlaceholder(LOCATION_PLACEHOLDER);
}

test.beforeEach(async ({ page }) => {
  await mockListingSources(page);
});

test("MAP-20: shows the geocoded option and expands the combobox", async ({ page }) => {
  await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));

  const input = await openLocationSearch(page);
  await input.fill("Madrid");

  await expect(page.getByRole("option", { name: /Madrid/ })).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");
});

test("MAP-20: while a new search loads, hides the previous options and the keyboard selects nothing", async ({
  page,
}) => {
  await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));

  const input = await openLocationSearch(page);
  await input.fill("Madrid");
  await expect(page.getByRole("option", { name: /Madrid/ })).toBeVisible();

  // Route again with a handler that never resolves, so the second search sits
  // in its loading state for the rest of the test.
  await page.route(NOMINATIM_URL, () => {
    // Never fulfilled — simulates a request still in flight.
  });
  await input.pressSequentially(" y");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("status")).toHaveText(/Cargando|Loading/);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  // Selecting would swap this input for a chip showing the location's name;
  // it staying in place with the typed text is proof nothing was selected.
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Madrid y");
});

test("MAP-20: selecting an option closes the dropdown", async ({ page }) => {
  await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));

  const input = await openLocationSearch(page);
  await input.fill("Madrid");

  const option = page.getByRole("option", { name: /Madrid/ });
  await expect(option).toBeVisible();
  await option.click();

  // LocationSearch swaps the input for a chip (MapPin icon, the location's
  // displayName, and an icon button whose only accessible name is
  // "Clear filters" — getByLabel targets that aria-label specifically, unlike
  // getByRole("button", { name }), which also matches SearchFilters' own
  // "Clear filters" text button elsewhere on the page.
  await expect(page.getByLabel(/clear filters|borrar filtros/i)).toBeVisible();
  // The dropdown's options are gone, not just hidden behind the chip — scoped
  // to role="option" because the chip repeats the same display name as text.
  await expect(page.getByRole("option")).toHaveCount(0);
});
