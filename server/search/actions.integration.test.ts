import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { makeMilanunciosResponse } from "@/test/fixtures/milanuncios";
import { makeCriteria } from "@/test/fixtures/alerts";

// FRONT-2/FRONT-4 (docs/specs/core-frontend.md). Mocked the same way
// server/password-reset/forgot-password.integration.test.ts mocks rate
// limiting on an action: the IP and the limiter's verdict are stubbed so the
// test does not need 121 real requests against Postgres to prove the
// rejection shape.
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.5"),
  consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 119, retryAfterMs: 0 })),
}));

import { consumeRateLimit } from "@/server/rate-limit/service";
import { EMPTY_SEARCH_CURSORS } from "./service";
import { listCarModels, searchListings } from "./actions";

const WALLAPOP = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET = "https://web.gw.coches.net/search/listing";
const MILANUNCIOS = "https://www.milanuncios.com/*";
const WALLAPOP_MODELS = "https://api.wallapop.com/api/v3/search/filters/model";
const COCHESNET_MODELS = "https://web.gw.coches.net/models";

beforeEach(() => {
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 119, retryAfterMs: 0 });
});

describe("searchListings", () => {
  it("FRONT-2: the 121st round from one IP within a minute is rejected before any upstream request", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });
    const calls: string[] = [];
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeWallapopResponse([]));
      }),
      http.post(COCHESNET, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeCochesNetResponse([]));
      }),
      http.get(MILANUNCIOS, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeMilanunciosResponse([]));
      }),
    );

    const result = await searchListings(makeCriteria(), EMPTY_SEARCH_CURSORS);

    expect(result).toEqual({
      ok: false,
      error: { code: "rateLimited", messageKey: "searchErrors.rateLimited" },
    });
    expect(calls).toEqual([]);
  });

  it("FRONT-2: rejects input the schema does not accept, with no upstream request", async () => {
    const calls: string[] = [];
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeWallapopResponse([]));
      }),
      http.post(COCHESNET, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeCochesNetResponse([]));
      }),
      http.get(MILANUNCIOS, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(makeMilanunciosResponse([]));
      }),
    );

    // Latitude is bounded at 90 by searchSchema (lib/search/schema.ts); 999
    // cannot be a coordinate.
    const result = await searchListings({ latitude: 999 }, EMPTY_SEARCH_CURSORS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalidInput");
    }
    expect(calls).toEqual([]);
  });

  it("MAP-27: a search with coordinates but no distanceInKm is bounded to 50 km of them", async () => {
    let wallapopQuery = new URLSearchParams();
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        wallapopQuery = new URL(request.url).searchParams;
        return HttpResponse.json(
          makeWallapopResponse([
            // ~29.6 km from Madrid (40.4168, -3.7038) — inside the 50 km default.
            makeWallapopItem({
              id: "wp-alcala",
              location: {
                latitude: 40.4818,
                longitude: -3.3643,
                postal_code: "28801",
                city: "Alcalá de Henares",
                region: "Madrid",
                country_code: "ES",
              },
            }),
            // ~66.9 km from Madrid — outside the 50 km default.
            makeWallapopItem({
              id: "wp-toledo",
              location: {
                latitude: 39.8628,
                longitude: -4.0273,
                postal_code: "45001",
                city: "Toledo",
                region: "Castilla-La Mancha",
                country_code: "ES",
              },
            }),
          ]),
        );
      }),
      http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([]))),
      http.get(MILANUNCIOS, () => HttpResponse.json(makeMilanunciosResponse([]))),
    );

    const result = await searchListings(
      { latitude: 40.4168, longitude: -3.7038 },
      EMPTY_SEARCH_CURSORS,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.listings.map((listing) => listing.id)).toEqual(["wallapop-wp-alcala"]);
    }
    expect(wallapopQuery.get("distance_in_km")).toBe("50");
  });
});

describe("listCarModels", () => {
  // The spec's worked example writes the make as "seat" (lowercase); this
  // test passes it as "Seat" instead, matching the exact capitalisation
  // `lib/cochesnet/taxonomy.ts`'s `BRAND_TO_MAKE_ID` map keys on and the UI's
  // brand selector already sends. Whether `listCarModels` normalises casing
  // before resolving the coches.net makeId is not decided anywhere in the
  // spec or the "decided surfaces" list, so this test does not assume it —
  // noted here rather than guessed silently.
  it("FRONT-4: merges the Wallapop and coches.net models for a make", async () => {
    server.use(
      http.get(WALLAPOP_MODELS, ({ request }) => {
        expect(new URL(request.url).searchParams.get("brand")).toBe("Seat");
        return HttpResponse.json({
          type: "model",
          id: "model",
          title: "Model",
          options: [{ id: "Leon", title: "Leon" }],
        });
      }),
      http.get(COCHESNET_MODELS, ({ request }) => {
        // mapBrandToMakeId("Seat") === 39 (lib/cochesnet/taxonomy.ts).
        expect(new URL(request.url).searchParams.get("makeId")).toBe("39");
        return HttpResponse.json({ items: [{ id: 501, label: "Ibiza" }] });
      }),
    );

    const result = await listCarModels("Seat");

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Order is not a decided contract here — only that both sources'
      // models survive the merge, hand-derived from the two fixtures above.
      expect(result.value.map((model) => model.label).sort()).toEqual(["Ibiza", "Leon"]);
    }
  });
});
