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

// docs/specs/redesign-map.md (MAPUI-3): "Dónde" replaces the filters panel's
// location field — the combobox now opens from the search pill's own
// segment instead of behind "Filtros".
// The Desktop Chrome device sends Accept-Language en-US, so the page renders
// in English (FRONT-9); the patterns match the segment's name in either locale.
// docs/specs/redesign-map.md (MAPUI-77, owner report 2026-10-31): the field
// reads «Ciudad…» / «City…» now, never «Ciudad o código postal…» — anchored
// so the pattern still matches only this field, not a result mentioning a
// city elsewhere on the page.
const WHERE_SEGMENT = /^ciudad…?$|^city…?$/i;
const LOCATION_PLACEHOLDER = /^ciudad…?$|^city…?$/i;

async function openLocationSearch(page: Page) {
  await page.goto("/map");
  await page.getByRole("button", { name: WHERE_SEGMENT }).first().click();
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
  // Scoped to the popover: the map's own StatusPill is a second status region.
  await expect(page.getByRole("dialog", { name: /dónde|where/i }).getByRole("status")).toHaveText(
    /Cargando|Loading/,
  );

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

  // Choosing applies the place at once: the «Dónde» segment is named by it,
  // with the radius in force (MAPUI-1, MAPUI-3).
  await expect(page.getByRole("button", { name: /madrid · 50 km/i })).toBeVisible();
  // The dropdown's options are gone, not just hidden — scoped to role="option"
  // because the field and the segment repeat the same display name as text.
  await expect(page.getByRole("option")).toHaveCount(0);
});

// docs/specs/redesign-map.md (MAPUI-78, bug fix, owner report 2026-10-31):
// Enter with nothing highlighted chooses the first listed place, exactly as
// clicking it does — reproduced in production on 2026-10-31, where Enter did
// nothing (worked example "Enter in «Dónde»").
test("MAPUI-78: Enter with no option highlighted chooses the first place, updating the URL", async ({
  page,
}) => {
  await page.route(NOMINATIM_URL, (route) => route.fulfill({ json: [MADRID_RESULT] }));

  const input = await openLocationSearch(page);
  await input.fill("28013");
  await expect(page.getByRole("option", { name: /Madrid/ })).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/locationName=Madrid/);
  await expect(page.getByRole("button", { name: /madrid · 50 km/i })).toBeVisible();
});

// docs/specs/redesign-map.md (MAPUI-81, amends MAP-20): Enter pressed while
// the search for the typed text is still running chooses nothing yet, and
// chooses the first place once that search answers.
test("MAPUI-81: Enter pressed immediately, with the answer delayed, still chooses the place once it arrives", async ({
  page,
}) => {
  let resolveReached: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => {
    resolveReached = resolve;
  });
  const routeGate = Promise.withResolvers<void>();
  await page.route(NOMINATIM_URL, async (route) => {
    resolveReached?.();
    await routeGate.promise;
    await route.fulfill({ json: [MADRID_RESULT] });
  });

  const input = await openLocationSearch(page);
  await input.fill("28013");
  await page.keyboard.press("Enter");

  await reached;

  // The request is still held: nothing chosen yet.
  await expect(page).not.toHaveURL(/locationName=/);

  routeGate.resolve();

  await expect(page).toHaveURL(/locationName=Madrid/, { timeout: 10000 });
  await expect(page.getByRole("button", { name: /madrid · 50 km/i })).toBeVisible();
});
