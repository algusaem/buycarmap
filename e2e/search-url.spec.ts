import { test, expect, type Page } from "@playwright/test";

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

async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /filter/i }).first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}

test("FRONT-13: a filtered search deep-links, reloads, and Back/Forward restore earlier filters", async ({
  page,
}) => {
  await mockUpstreams(page);

  await page.goto("/map?make=seat&maxPrice=10000&radius=50");
  await expect(page.getByText("Seat León 1.5 TSI")).toBeVisible();

  await openFilters(page);
  await expect(page.getByRole("combobox", { name: /Brand/ })).toHaveAccessibleName(/Brand/);
  await expect(page.getByPlaceholder(/^Max\s€$/)).toHaveValue("10000");

  // A reload must restore the same filters from the URL alone.
  await page.reload();
  await openFilters(page);
  await expect(page.getByPlaceholder(/^Max\s€$/)).toHaveValue("10000");

  // Change maxPrice to 8000 …
  const maxPriceInput = page.getByPlaceholder(/^Max\s€$/);
  await maxPriceInput.fill("8000");
  await maxPriceInput.blur();
  await expect(page).toHaveURL(/maxPrice=8000/);

  // … then Back returns to the 10 000 search and its results.
  await page.goBack();
  await expect(page).toHaveURL(/maxPrice=10000/);
  await openFilters(page);
  await expect(page.getByPlaceholder(/^Max\s€$/)).toHaveValue("10000");
});
