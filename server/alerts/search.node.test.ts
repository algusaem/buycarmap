import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetItem, makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { makeCriteria, makeMatchListing } from "@/test/fixtures/alerts";
import * as searchService from "@/server/search/service";
import { EMPTY_SEARCH_CURSORS } from "@/server/search/service";
import { searchAllSources } from "./search";

const WALLAPOP = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET = "https://web.gw.coches.net/search/listing";
const MILANUNCIOS = "https://www.milanuncios.com/*";

/** Captures the query string the runner sends to Wallapop. */
function captureWallapopQuery(): () => URLSearchParams {
  let captured = new URLSearchParams();
  server.use(
    http.get(WALLAPOP, ({ request }) => {
      captured = new URL(request.url).searchParams;
      return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
    }),
  );
  return () => captured;
}

/** Captures the JSON body the runner posts to coches.net. */
function captureCochesNetBody(): () => Record<string, unknown> {
  let captured: Record<string, unknown> = {};
  server.use(
    http.post(COCHESNET, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1));
    }),
  );
  return () => captured;
}

const failWith = (status: number) => () => new HttpResponse(null, { status });

describe("searchAllSources", () => {
  it("forces newest-first on Wallapop even when a location is set", async () => {
    const query = captureWallapopQuery();

    await searchAllSources(makeCriteria());

    // The interactive path uses most_relevance once located. An alert reads
    // only page one, so a listing ranked twentieth is one it never sees.
    expect(query().get("order_by")).toBe("newest");
  });

  it("narrows Wallapop to today when the criteria name no window", async () => {
    const query = captureWallapopQuery();

    await searchAllSources(makeCriteria());

    expect(query().get("time_filter")).toBe("today");
  });

  it("keeps a window the criteria did name", async () => {
    const query = captureWallapopQuery();

    await searchAllSources(makeCriteria({ timeFilter: "lastWeek" }));

    expect(query().get("time_filter")).toBe("lastWeek");
  });

  it("always sends coordinates to Wallapop, even with no location chosen", async () => {
    const query = captureWallapopQuery();

    await searchAllSources({ brand: "Audi" });

    // Without them Wallapop geo-filters by the caller's IP, and on Vercel that
    // is a US datacenter returning US listings.
    expect(query().get("latitude")).toBe("40");
    expect(query().get("longitude")).toBe("-3.5");
  });

  it("asks coches.net for the most recently published first", async () => {
    const body = captureCochesNetBody();

    await searchAllSources(makeCriteria());

    expect(body().sort).toEqual({ order: "desc", term: "publishedDate" });
  });

  it("reports a count per source, before merging", async () => {
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(
          makeWallapopResponse([makeWallapopItem({ id: "w1" }), makeWallapopItem({ id: "w2" })]),
        ),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 1)),
      ),
    );

    const result = await searchAllSources(makeCriteria());

    // After merging, "returned nothing" and "is quietly broken" are the same
    // observation — which is the failure this feature has to catch.
    expect(result.perSourceCounts.Wallapop).toBe(2);
    expect(result.perSourceCounts["Coches.net"]).toBe(1);
  });

  it("ALERT-43: drops a listing outside the radius, at the country-centre fallback, or naming a different model", async () => {
    const wpNear = makeMatchListing({
      id: "wallapop-wp-near",
      source: "Wallapop",
      model: "Serie 3",
      title: "BMW Serie 3 320d",
      lat: 40.4818,
      lng: -3.3643,
    });
    const cnFar = makeMatchListing({
      id: "cochesnet-cn-far",
      source: "Coches.net",
      model: "Serie 3",
      title: "BMW Serie 3 320d",
      lat: 41.3874,
      lng: 2.1686,
    });
    const mnFallback = makeMatchListing({
      id: "milanuncios-mn-fallback",
      source: "Milanuncios",
      model: "",
      title: "BMW Serie 3 320d",
      lat: 40.0,
      lng: -3.5,
    });
    const cnWrongModel = makeMatchListing({
      id: "cochesnet-cn-wrong-model",
      source: "Coches.net",
      model: "Serie 5",
      title: "BMW Serie 5 530d",
      lat: 40.3057,
      lng: -3.7329,
    });
    const spy = vi.spyOn(searchService, "searchRound").mockResolvedValue({
      listings: [wpNear, cnFar, mnFallback, cnWrongModel],
      cursors: EMPTY_SEARCH_CURSORS,
      hasMore: { Wallapop: false, "Coches.net": false, Milanuncios: false },
      failedSources: [],
    });

    try {
      const result = await searchAllSources(
        makeCriteria({
          brand: "BMW",
          model: "Serie 3",
          latitude: 40.4168,
          longitude: -3.7038,
          distanceInKm: 100,
        }),
      );

      // The map search's own promise (MAP-16, MAP-17, MAP-18): wrong radius,
      // the country-centre fallback, and a mismatched model are all excluded,
      // so an alert never promises less than the search it was saved from.
      expect(result.listings.map((listing) => listing.id)).toEqual(["wallapop-wp-near"]);
      // Counted before the filter, not after (ALERT-44): a narrow radius
      // filtering a nationwide page to nothing must not read as the source
      // being empty.
      expect(result.perSourceCounts).toEqual({ Wallapop: 1, "Coches.net": 2, Milanuncios: 1 });
    } finally {
      spy.mockRestore();
    }
  });

  it("ALERT-44: a page the post-filter empties still reports its pre-filter count, with no further page requested", async () => {
    const cnBcn1 = makeMatchListing({
      id: "cochesnet-cn-bcn-1",
      source: "Coches.net",
      lat: 41.3874,
      lng: 2.1686,
    });
    const cnBcn2 = makeMatchListing({
      id: "cochesnet-cn-bcn-2",
      source: "Coches.net",
      lat: 41.3874,
      lng: 2.1686,
    });
    const spy = vi.spyOn(searchService, "searchRound").mockResolvedValue({
      listings: [cnBcn1, cnBcn2],
      cursors: EMPTY_SEARCH_CURSORS,
      // More pages are available, but the poll reads one page per source
      // regardless (ALERT-44) — unlike the map search's MAP-19, which keeps
      // fetching, because a poll has no dead end: the next lap runs anyway.
      hasMore: { Wallapop: false, "Coches.net": true, Milanuncios: false },
      failedSources: [],
    });

    try {
      const result = await searchAllSources(
        makeCriteria({
          brand: "BMW",
          model: undefined,
          latitude: 40.4168,
          longitude: -3.7038,
          distanceInKm: 100,
        }),
      );

      expect(result.listings).toEqual([]);
      expect(result.perSourceCounts).toEqual({ Wallapop: 0, "Coches.net": 2, Milanuncios: 0 });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("names a failed source and still returns the survivors' listings", async () => {
    server.use(http.get(WALLAPOP, failWith(503)));

    // No location or model: this test is about failedSources propagation,
    // not the ALERT-43 post-filter, and the default fixtures' city/model do
    // not match makeCriteria()'s defaults.
    const result = await searchAllSources(
      makeCriteria({
        model: undefined,
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );

    expect(result.failedSources).toEqual(["Wallapop"]);
    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.some((l) => l.source === "Wallapop")).toBe(false);
    // A failed source reports no count either — zero would be a lie that reads
    // as "nothing new".
    expect(result.perSourceCounts.Wallapop).toBeUndefined();
  });

  it("survives two of the three failing", async () => {
    server.use(http.get(WALLAPOP, failWith(503)), http.post(COCHESNET, failWith(500)));

    // No location or model — see the comment in the test above.
    const result = await searchAllSources(
      makeCriteria({
        model: undefined,
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );

    expect(result.failedSources.sort()).toEqual(["Coches.net", "Wallapop"]);
    expect(result.listings.length).toBeGreaterThan(0);
  });

  it("throws when every source fails", async () => {
    server.use(
      http.get(WALLAPOP, failWith(503)),
      http.post(COCHESNET, failWith(500)),
      http.get(MILANUNCIOS, failWith(403)),
    );

    // The caller must treat this as "no information", not "nothing new" — a
    // total outage that looked like an empty poll would advance nothing while
    // reporting success.
    await expect(searchAllSources(makeCriteria())).rejects.toThrow(/every source failed/i);
  });

  it("falls back to make-only filtering when the model taxonomy is unreachable", async () => {
    const body = captureCochesNetBody();
    server.use(http.get("https://web.gw.coches.net/models", failWith(500)));

    await searchAllSources(makeCriteria({ brand: "Audi", model: "A3" }));

    // Model filtering is a refinement; losing it degrades the poll rather than
    // failing the source outright.
    const filters = body().filters as { vehicles?: { modelId?: number }[] };
    expect(filters.vehicles?.[0].modelId).toBeUndefined();
    expect(filters.vehicles?.[0]).toHaveProperty("makeId");
  });

  it("normalizes every source into the shared listing shape", async () => {
    const result = await searchAllSources(makeCriteria());

    for (const listing of result.listings) {
      expect(listing.id).toMatch(/^(wallapop|cochesnet|milanuncios)-/);
      expect(typeof listing.title).toBe("string");
      expect(typeof listing.price).toBe("number");
    }
  });

  // FRONT-6 (docs/specs/core-frontend.md): the runner must stop keeping its
  // own fan-out and delegate to server/search/service.ts's searchRound, so
  // there is one fan-out shared with the interactive search.
  it("FRONT-6: delegates its fan-out to server/search/service's searchRound", async () => {
    const spy = vi.spyOn(searchService, "searchRound");

    // The point of this assertion is only that the runner calls searchRound
    // at all, not what it returns — tolerate a throw regardless of cause.
    await searchAllSources(makeCriteria()).catch(() => {
      // Intentionally ignored; see above.
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
