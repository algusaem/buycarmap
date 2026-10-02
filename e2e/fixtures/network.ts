import type { Page } from "@playwright/test";

// Deterministic payloads for the mock upstream server
// (e2e/fixtures/upstream-server.ts) so e2e never touches live
// Wallapop/coches.net/Milanuncios. Kept intentionally small and
// self-contained (e2e can't import Vitest fixtures cleanly across the
// tsconfig boundary).
//
// FRONT-22 (docs/specs/core-frontend.md): search now runs through a Server
// Action (server/search/service.ts), so page.route() can no longer stub it —
// the request never reaches the browser. mockListingSources switches the mock
// upstream server's scenario instead of routing the page; only image
// optimisation requests (still browser-side) are routed here.
export const wallapopFixture = {
  data: {
    section: {
      type: "cars",
      title: "Cars",
      items: [
        {
          id: "e2e-wp-1",
          title: "Audi A3 2.0 TDI",
          description: "Full service history",
          price: { amount: 14500, currency: "EUR" },
          images: [
            {
              id: "i",
              average_color: "#333",
              urls: {
                small: "",
                medium: "",
                big: "https://cdn.wallapop.com/e2e.jpg",
              },
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
          web_slug: "audi-a3-e2e-wp-1",
          type_attributes: {
            brand: "Audi",
            model: "A3",
            year: 2018,
            km: 95000,
            engine: "gasoil",
            horsepower: 150,
          },
        },
      ],
    },
  },
  meta: { next_page: null },
};

export const cochesNetFixture = {
  items: [
    {
      id: "e2e-cn-1",
      title: "BMW Serie 3 320d",
      url: "/bmw-serie_3/e2e-cn-1",
      price: { amount: 18900, hasTaxes: true },
      km: 120000,
      year: 2019,
      hp: 190,
      make: "BMW",
      makeId: 7,
      model: "Serie 3",
      modelId: 4321,
      fuelType: "Diésel",
      fuelTypeId: 1,
      transmissionTypeId: 1,
      resources: [{ type: "IMAGE", url: "https://cdn.wallapop.com/e2e.jpg" }],
      location: {
        provinceIds: [8],
        regionId: 9,
        regionLiteral: "Cataluña",
        mainProvince: "Barcelona",
        mainProvinceId: 8,
        cityId: 810,
        cityLiteral: "Barcelona",
      },
      isProfessional: true,
    },
  ],
  paidItems: [],
  meta: { totalPages: 1, totalResults: 1 },
};

// The raw ads+pagination node — upstream-server.ts wraps it in the HTML shell
// Milanuncios actually serves (lib/milanuncios/parse.ts's extractInitialProps
// reads window.__INITIAL_PROPS__ = JSON.parse("…") back out of it).
export const milanunciosFixture = {
  ads: [
    {
      id: "e2e-mn-1",
      title: "SEAT León 1.5 TSI",
      url: "/seat-de-segunda-mano/seat-leon-e2e-mn-1.htm",
      description: "Único propietario, garantía 12 meses",
      category: { id: 850, name: "Seat", slug: "seat-de-segunda-mano" },
      price: { cashPrice: { value: 16500, includeTaxes: true } },
      images: ["https://images.milanuncios.com/e2e.jpg"],
      tags: [
        { type: "kilómetros", text: "60.000 kms" },
        { type: "año", text: "2020" },
        { type: "combustible", text: "gasolina" },
      ],
      location: {
        city: { id: 1, name: "Sevilla", slug: "sevilla" },
        province: { id: 41, name: "Sevilla", slug: "sevilla" },
      },
      isReserved: "RELEASED",
    },
  ],
  pagination: { page: 1, resultsPerPage: 41, totalAds: 1, totalPages: 1 },
};

// The "empty" scenario: all three sources return zero listings, formerly
// screenshots.spec.ts's own inline page.route() overrides for its "map
// results list — empty" screenshot.
export const emptyWallapopFixture = {
  data: { section: { type: "cars", title: "Cars", items: [] } },
  meta: { next_page: null },
};
export const emptyCochesNetFixture = {
  items: [],
  paidItems: [],
  meta: { totalPages: 0, totalResults: 0 },
};
export const emptyMilanunciosFixture = {
  ads: [],
  pagination: { page: 1, resultsPerPage: 41, totalAds: 0, totalPages: 0 },
};

// The two model-lookup endpoints (server/search/service.ts's
// WALLAPOP_MODELS_URL / COCHESNET_MODELS_URL) stay empty in every scenario —
// no e2e test asserts on a specific model list, only that filtering by model
// doesn't crash the round.
export const wallapopModelsFixture = { type: "model", id: "model", title: "Model", options: [] };
export const cochesNetModelsFixture = { items: [] };

// Wraps a Milanuncios ads+pagination node in the SSR page shell
// lib/milanuncios/parse.ts's extractInitialProps reads back out of:
// window.__INITIAL_PROPS__ = JSON.parse("<escaped>"). Mirrors
// test/fixtures/milanuncios.ts's makeMilanunciosHtml, which e2e can't import
// across the tsconfig boundary (see the file header).
export function milanunciosHtml(response: typeof milanunciosFixture): string {
  const props = {
    adListPagination: {
      adList: { ads: response.ads },
      pagination: response.pagination,
    },
  };
  const literal = JSON.stringify(JSON.stringify(props));
  return `<!doctype html><html><head></head><body><script>window.__INITIAL_PROPS__ = JSON.parse(${literal});</script></body></html>`;
}

// A 1x1 opaque PNG. The fixture listings point at real hosts (next.config only
// allows a fixed set), but those URLs do not exist — so next/image really
// fetched them and really got 403/404, and the resulting empty image slot
// rendered differently depending on when the failure landed. That was the sole
// cause of the map screenshot flaking; it also spammed the dev server log on
// every functional run.
const TRANSPARENT_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Serve every optimized image from a fixed byte sequence. */
async function mockListingImages(page: Page) {
  await page.route("**/_next/image**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PIXEL_PNG,
    }),
  );
}

// Must match e2e/fixtures/upstream-server.ts's own default — duplicated
// rather than shared through a third file, the same call favorites.spec.ts's
// header comment makes about not coupling files to save a few lines.
const UPSTREAM_PORT = process.env.E2E_UPSTREAM_PORT ?? "3912";

/**
 * Switches the mock upstream server's scenario (e2e/fixtures/upstream-server.ts).
 *
 * FRONT-22 (docs/specs/core-frontend.md): search now runs through a Server
 * Action, so the request this used to intercept with `page.route()` never
 * reaches the browser — this is a Node-to-Node control-plane call instead,
 * not something the page sees.
 */
export async function setUpstreamScenario(scenario: "default" | "empty"): Promise<void> {
  const response = await fetch(`http://localhost:${UPSTREAM_PORT}/__scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  if (!response.ok) {
    throw new Error(`Failed to switch e2e upstream scenario to "${scenario}": ${response.status}`);
  }
}

/** Points the mock upstream server at its "default" scenario (one listing per source). */
export async function mockListingSources(page: Page) {
  // Images are part of "don't touch the network", so they belong here rather
  // than in each caller.
  await mockListingImages(page);

  await setUpstreamScenario("default");
}
