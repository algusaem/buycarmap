import { test, expect, type Page } from "@playwright/test";
import { stubMapTiles } from "./fixtures/map-tiles";

// docs/specs/map-maplibre.md: no run reaches OpenFreeMap — a page that opens
// a map draws it from stubbed tiles (e2e/fixtures/map-tiles.ts).
test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

// FRONT-13 (docs/specs/core-frontend.md). The source proxies FRONT-5 deletes
// no longer exist, so — unlike e2e/fixtures/network.ts's `mockListingSources`,
// which switches the mock upstream server's scenario (FRONT-22) — this stubs
// the three upstreams directly with page.route(). Kept local to this file
// rather than added to network.ts, which this brief does not authorise
// changing.
//
// Not run as part of this change (brief: "Do not run it"). Written against
// the spec's literal worked example param names (`make`, `maxPrice`,
// `radius`) — `lib/search/url-state.ts`'s `searchParsers` is still a stub
// returning no parsers, so these names are what the spec commits to, not
// yet what any code produces.

const wallapop = {
  data: {
    section: {
      type: "cars",
      title: "Cars",
      items: [
        {
          id: "url-wp-1",
          title: "Seat León 1.5 TSI",
          description: "Full service history",
          price: { amount: 9500, currency: "EUR" },
          images: [
            {
              id: "i",
              average_color: "#333",
              urls: { small: "", medium: "", big: "https://cdn.wallapop.com/e2e.jpg" },
            },
          ],
          location: {
            latitude: 40.4168,
            longitude: -3.7038,
            postal_code: "28001",
            city: "Madrid",
            region: "Madrid",
            country_code: "ES",
          },
          reserved: { flag: false },
          web_slug: "seat-leon-url-wp-1",
          type_attributes: {
            brand: "Seat",
            model: "León",
            year: 2019,
            km: 60000,
            engine: "gasoline",
            horsepower: 130,
          },
        },
      ],
    },
  },
  meta: { next_page: null },
};

const cochesnet = { items: [], paidItems: [], meta: { totalPages: 0, totalResults: 0 } };
const milanuncios = {
  ads: [],
  pagination: { page: 1, resultsPerPage: 41, totalAds: 0, totalPages: 0 },
};

async function mockUpstreams(page: Page) {
  await page.route("https://api.wallapop.com/api/v3/search/section**", (route) =>
    route.fulfill({ json: wallapop }),
  );
  await page.route("https://web.gw.coches.net/search/listing", (route) =>
    route.fulfill({ json: cochesnet }),
  );
  await page.route("https://www.milanuncios.com/**", (route) =>
    route.fulfill({ json: milanuncios }),
  );
  await page.route("https://api.wallapop.com/api/v3/search/filters/model**", (route) =>
    route.fulfill({ json: { type: "model", id: "model", title: "Model", options: [] } }),
  );
  await page.route("https://web.gw.coches.net/models**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/_next/image**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
}

// docs/specs/redesign-map.md (MAPUI-49): price now lives in the pill's
// «Precio» popover, not the filters panel — the brand check below still
// opens the panel's «Marca y modelo» section, which MAPUI-14 keeps.
async function openPricePopover(page: Page) {
  const segment = page
    .getByRole("button", { name: /^(cualquiera|any)$|^(hasta|desde|up to|from) /i })
    .first();
  if ((await segment.getAttribute("aria-expanded")) !== "true") {
    await segment.click();
  }
  await expect(segment).toHaveAttribute("aria-expanded", "true");
}

async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /filtros|filters/i }).first();
  // Back is a soft navigation: the panel can still be open, and clicking the
  // toggle then would close it.
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

test("FRONT-13/MAPUI-49: a filtered search deep-links, reloads, and Back/Forward restore earlier filters", async ({
  page,
}) => {
  await mockUpstreams(page);

  await page.goto("/map?make=seat&maxPrice=10000&radius=50");
  await expect(page.getByText("Seat León 1.5 TSI")).toBeVisible();

  await openFilters(page);
  // With a brand in the URL the panel's field becomes «Modelo de seat…»
  // (MAPUI-7), so its name proves the brand was restored.
  await expect(page.getByRole("combobox", { name: /modelo de seat|seat model/i })).toBeVisible();

  await openPricePopover(page);
  await expect(page.getByRole("textbox", { name: /^(máximo|maximum)$/i })).toHaveValue("10,000");

  // A reload must restore the same filters from the URL alone.
  await page.reload();
  await openPricePopover(page);
  await expect(page.getByRole("textbox", { name: /^(máximo|maximum)$/i })).toHaveValue("10,000");

  // nuqs (2.10.1) clears its queued update on Back only once its popstate
  // listener is registered, after hydration; a Back before that leaves the
  // filters on the queued value while the URL moves (FRONT-13 › Edge cases).
  // Wait for that listener so the test exercises Back on a settled page.
  await page.waitForFunction(() => "nuqs" in history);

  // Change maxPrice to 8000 …
  const maxPriceInput = page.getByRole("textbox", { name: /^(máximo|maximum)$/i });
  await maxPriceInput.fill("8000");
  await maxPriceInput.blur();
  await expect(page).toHaveURL(/maxPrice=8000/);

  // … then Back returns to the 10 000 search and its results.
  await page.goBack();
  await expect(page).toHaveURL(/maxPrice=10000/);
  await openPricePopover(page);
  await expect(page.getByRole("textbox", { name: /^(máximo|maximum)$/i })).toHaveValue("10,000");
});
