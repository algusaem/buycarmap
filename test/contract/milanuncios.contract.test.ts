import { describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { z } from "zod";
import { server } from "../msw/server";
import { extractInitialProps } from "@/lib/milanuncios/parse";
import {
  makeMilanunciosAd,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";

// The subset of a Milanuncios ad that normalize.ts + geo.ts read. km/year/fuel
// live inside tags[] as display strings; there is no lat/lng or structured
// model, so those are deliberately absent.
const milanunciosAdContract = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  category: z.object({ name: z.string() }).optional(),
  price: z
    .object({ cashPrice: z.object({ value: z.number() }).optional() })
    .optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
  location: z
    .object({
      city: z.object({ name: z.string() }).partial().optional(),
      province: z.object({ id: z.number(), name: z.string() }).partial().optional(),
    })
    .optional(),
});

const SEARCH_URL =
  "https://www.milanuncios.com/coches-de-segunda-mano/";

describe("Milanuncios response contract", () => {
  it("SRC-15: the fixture satisfies the shape the normalizer depends on", () => {
    const { ads } = makeMilanunciosResponse([makeMilanunciosAd()]);
    expect(milanunciosAdContract.safeParse(ads[0]).success).toBe(true);
  });

  it.runIf(process.env.CONTRACT_LIVE)(
    "the live search page still embeds ads matching the contract",
    async () => {
      server.use(http.get(SEARCH_URL, () => passthrough()));

      const res = await fetch(SEARCH_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });
      expect(res.ok).toBe(true);

      const { ads } = extractInitialProps(await res.text());
      expect(ads.length).toBeGreaterThan(0);

      const parsed = milanunciosAdContract.safeParse(ads[0]);
      if (!parsed.success) {
        throw new Error(
          `Milanuncios contract drift:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }
    },
    30_000,
  );
});
