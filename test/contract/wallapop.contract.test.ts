import { describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { z } from "zod";
import { server } from "../msw/server";
import { makeWallapopItem, makeWallapopResponse } from "../fixtures/wallapop";

// The subset of the Wallapop response that normalizeWallapopItems() actually
// reads. If Wallapop renames/drops any of these, normalization silently
// degrades — this contract fails first. Unknown extra keys are allowed.
const wallapopItemContract = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.object({ amount: z.number() }),
  images: z
    .array(z.object({ urls: z.object({ big: z.string().optional() }) }))
    .optional(),
  location: z
    .object({
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      city: z.string().optional(),
    })
    .optional(),
  reserved: z.object({ flag: z.boolean() }).optional(),
  web_slug: z.string().optional(),
  type_attributes: z
    .object({
      brand: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      km: z.number().optional(),
      engine: z.string().optional(),
      horsepower: z.number().optional(),
    })
    .optional(),
});

const wallapopResponseContract = z.object({
  data: z.object({
    section: z.object({ items: z.array(wallapopItemContract) }),
  }),
  meta: z.object({ next_page: z.string().nullable() }),
});

const UPSTREAM = "https://api.wallapop.com/api/v3/search/section";

describe("Wallapop response contract", () => {
  it("the fixture satisfies the shape the normalizer depends on", () => {
    const response = makeWallapopResponse([makeWallapopItem()], "page-2");
    expect(wallapopResponseContract.safeParse(response).success).toBe(true);
  });

  it.runIf(process.env.CONTRACT_LIVE)(
    "the live API still matches the contract",
    async () => {
      // Let this one request reach the real API; MSW intercepts everything else.
      server.use(http.get(UPSTREAM, () => passthrough()));

      const url = new URL(UPSTREAM);
      url.searchParams.set("category_id", "100");
      url.searchParams.set("latitude", "40.0");
      url.searchParams.set("longitude", "-3.5");
      url.searchParams.set("distance_in_km", "100");

      const res = await fetch(url, {
        headers: { "x-deviceos": "0", "x-appversion": "85000" },
      });
      expect(res.ok).toBe(true);

      const body = await res.json();
      const parsed = wallapopResponseContract.safeParse(body);
      if (!parsed.success) {
        throw new Error(
          `Wallapop contract drift:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }
    },
    30_000,
  );
});
