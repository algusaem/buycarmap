import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import {
  makeCochesNetItem,
  makeCochesNetResponse,
} from "@/test/fixtures/cochesnet";
import { makeCriteria } from "@/test/fixtures/alerts";
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

const failWith = (status: number) => () =>
  new HttpResponse(null, { status });

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
          makeWallapopResponse([
            makeWallapopItem({ id: "w1" }),
            makeWallapopItem({ id: "w2" }),
          ]),
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

  it("names a failed source and still returns the survivors' listings", async () => {
    server.use(http.get(WALLAPOP, failWith(503)));

    const result = await searchAllSources(makeCriteria());

    expect(result.failedSources).toEqual(["Wallapop"]);
    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.some((l) => l.source === "Wallapop")).toBe(false);
    // A failed source reports no count either — zero would be a lie that reads
    // as "nothing new".
    expect(result.perSourceCounts.Wallapop).toBeUndefined();
  });

  it("survives two of the three failing", async () => {
    server.use(
      http.get(WALLAPOP, failWith(503)),
      http.post(COCHESNET, failWith(500)),
    );

    const result = await searchAllSources(makeCriteria());

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
    await expect(searchAllSources(makeCriteria())).rejects.toThrow(
      /every source failed/i,
    );
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
});
