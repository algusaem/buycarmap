import { describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { z } from "zod";
import { server } from "../msw/server";
import { makeCochesNetItem, makeCochesNetResponse } from "../fixtures/cochesnet";

// The subset of the coches.net response normalizeCochesNetItems() + geo.ts read.
const cochesNetItemContract = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: z.string(),
  price: z.object({ amount: z.number() }),
  km: z.number().optional(),
  year: z.number().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  fuelType: z.string().optional(),
  resources: z.array(z.object({ type: z.string(), url: z.string() })).optional(),
  location: z.object({
    mainProvince: z.string().optional(),
    mainProvinceId: z.number(),
    cityLiteral: z.string().optional(),
  }),
});

const cochesNetResponseContract = z.object({
  items: z.array(cochesNetItemContract),
  meta: z.object({ totalPages: z.number() }),
});

const UPSTREAM = "https://web.gw.coches.net/search/listing";

describe("coches.net response contract", () => {
  it("SRC-15: the fixture satisfies the shape the normalizer depends on", () => {
    const response = makeCochesNetResponse([makeCochesNetItem()], 3);
    expect(cochesNetResponseContract.safeParse(response).success).toBe(true);
  });

  it.runIf(process.env.CONTRACT_LIVE)(
    "the live API still matches the contract",
    async () => {
      server.use(http.post(UPSTREAM, () => passthrough()));

      const res = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Schibsted-Tenant": "coches",
        },
        body: JSON.stringify({
          pagination: { page: 1, size: 40 },
          sort: { order: "desc", term: "relevance" },
          filters: {},
        }),
      });
      expect(res.ok).toBe(true);

      const body: unknown = await res.json();
      const parsed = cochesNetResponseContract.safeParse(body);
      if (!parsed.success) {
        throw new Error(
          `coches.net contract drift:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }
    },
    30_000,
  );
});
