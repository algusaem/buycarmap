import type { Page } from "@playwright/test";

// Deterministic proxy responses so e2e never touches live Wallapop/coches.net.
// Kept intentionally small and self-contained (e2e can't import Vitest fixtures
// cleanly across the tsconfig boundary).
const wallapop = {
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

const cochesnet = {
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

const milanuncios = {
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

/** Route all three source proxies to fixed payloads. */
export async function mockListingSources(page: Page) {
  // Images are part of "don't touch the network", so they belong here rather
  // than in each caller.
  await mockListingImages(page);

  await page.route("**/api/wallapop/search**", (route) => route.fulfill({ json: wallapop }));
  await page.route("**/api/cochesnet/search**", (route) => route.fulfill({ json: cochesnet }));
  await page.route("**/api/milanuncios/search**", (route) => route.fulfill({ json: milanuncios }));
  await page.route("**/api/cochesnet/models**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/wallapop/filters/models**", (route) =>
    route.fulfill({ json: { type: "model", id: "model", title: "Model", options: [] } }),
  );
}
