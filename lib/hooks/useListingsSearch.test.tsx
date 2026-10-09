import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetItem, makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import {
  makeMilanunciosAd,
  makeMilanunciosHtml,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";
import { triggerIntersection } from "@/test/mocks/intersection-observer";
import type { SearchInput } from "@/lib/search/schema";
import type { SearchCursors } from "@/server/search/service";
import { useListingsSearch } from "./useListingsSearch";

// FRONT-3 (docs/specs/core-frontend.md): every round now goes through the
// `searchListings` Server Action instead of three separate fetches, so the
// network setup targets the upstream APIs directly (same hosts
// server/search/service.node.test.ts and server/alerts/search.node.test.ts
// use) rather than the local `/api/wallapop|cochesnet|milanuncios/search`
// proxies FRONT-5 deletes. Every fixture and expected value below is
// unchanged from before the conversion — only which URL carries them moved.
const WALLAPOP = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET = "https://web.gw.coches.net/search/listing";
const MILANUNCIOS = "https://www.milanuncios.com/*";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
// The mock IS the real fan-out: it delegates to the real `searchRound`
// (server/search/service.ts) against the MSW upstream handlers above, so
// every MAP-1..22 expected value keeps coming from the same merge/filter/
// normalize code path it always has — only the transport (one Server Action
// call instead of three direct fetches) is what FRONT-3 changes.
// `searchRound` is still a stub that throws ("not implemented"), so until it
// and the hook itself are implemented, this mock is a correct contract
// nothing yet exercises through the hook.
vi.mock("@/server/search/actions", async () => {
  const { searchRound } = await import("@/server/search/service");
  const { applyResultFilters } = await import("@/lib/listings/merge");
  return {
    searchListings: vi.fn(async (input: SearchInput, cursors: SearchCursors) => {
      const round = await searchRound(input, cursors);
      return { ok: true, value: { ...round, listings: applyResultFilters(round.listings, input) } };
    }),
  };
});
import { toast } from "sonner";
import { searchListings } from "@/server/search/actions";

afterEach(() => vi.clearAllMocks());

describe("useListingsSearch", () => {
  it("MAP-1: interleaves all three sources and sets hasMore", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "interleave-case" });
    });

    // Default handlers return one item per source; interleave round-robins them.
    expect(result.current.listings.map((l) => l.source)).toEqual([
      "Wallapop",
      "Coches.net",
      "Milanuncios",
    ]);
    // wallapop next_page "page-2", coches.net totalPages 3, milanuncios
    // totalPages 5 → more available.
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("MAP-2: still renders the remaining sources when one fails", async () => {
    server.use(http.get(WALLAPOP, () => HttpResponse.json({ error: "down" }, { status: 500 })));
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "partial-failure" });
    });

    expect(result.current.listings.map((l) => l.source)).toEqual(["Coches.net", "Milanuncios"]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("MAP-3: sets the error state and renders nothing when every source fails", async () => {
    // FRONT-15 (docs/specs/core-frontend.md): a failed read is never a toast —
    // MapView renders the FRONT-14 inline error state (with Retry) from this
    // boolean instead.
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "all-fail" });
    });

    expect(result.current.listings).toEqual([]);
    expect(result.current.error).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("MAP-5: serves a repeated identical search from cache without refetching", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "cache-hit" });
    });
    const first = result.current.listings;

    // Every endpoint now fails — a cache hit means we never touch them.
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({}, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({}, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({}, { status: 500 })),
    );

    await act(async () => {
      await result.current.search({ keywords: "cache-hit" });
    });

    expect(result.current.listings).toEqual(first);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("MAP-4: discards a stale response that resolves after a newer search", async () => {
    let call = 0;
    server.use(
      http.get(WALLAPOP, async () => {
        call += 1;
        if (call === 1) {
          await delay(80); // the stale, slow first search
          return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "stale" })]));
        }
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "fresh" })]));
      }),
      http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([]))),
    );

    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      result.current.search({ keywords: "first-slow" }); // not awaited
      await result.current.search({ keywords: "second-fast" });
      await delay(120); // let the slow one resolve and be discarded
    });

    const ids = result.current.listings.map((l) => l.id);
    expect(ids).toContain("wallapop-fresh");
    expect(ids).not.toContain("wallapop-stale");
  });

  it("MAP-8: appends the next page when the scroll sentinel intersects", async () => {
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(makeWallapopResponse([makeWallapopItem()], "page-2")),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 3)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 5))),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "paginate" });
    });
    // One item per source on page 1.
    expect(result.current.listings).toHaveLength(3);

    // Attach the sentinel, then simulate it scrolling into view.
    act(() => result.current.sentinelRef(document.createElement("div")));
    await act(async () => {
      triggerIntersection();
    });

    // Each source still has a further page → one more item each.
    await waitFor(() => expect(result.current.listings).toHaveLength(6));
  });
});

describe("useListingsSearch validation and copy", () => {
  it("MAP-6: makes no request when the parameters are invalid", async () => {
    const calls: string[] = [];
    const record = ({ request }: { request: Request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    };
    server.use(
      http.get(WALLAPOP, record),
      http.post(COCHESNET, record),
      http.get(MILANUNCIOS, record),
    );
    const { result } = renderHook(() => useListingsSearch());

    // Latitude is bounded at 90 by searchSchema; 999 cannot be a coordinate.
    await act(async () => {
      await result.current.search({ keywords: "bad-params", latitude: 999 });
    });

    expect(calls).toEqual([]);
    expect(result.current.listings).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("MAP-7: sets the error state when every source fails, never a toast", async () => {
    // FRONT-15 (docs/specs/core-frontend.md) supersedes MAP-7's original
    // toast-in-the-user's-language behaviour: the results list now renders
    // its own inline error state (FRONT-14), translated there, not surfaced
    // through a toast at all.
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "localised-failure" });
    });

    expect(result.current.error).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("MAP-7: sets the error state for invalid filters, never a toast", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "localised-invalid", latitude: 999 });
    });

    expect(result.current.error).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useListingsSearch radius filter", () => {
  // Search centre for every case: Madrid (40.4168, -3.7038).
  // Hand-derived great-circle distances from that point:
  //   Getafe (40.3088, -3.7328)            ≈ 12 km  → inside 100 km
  //   Alcalá de Henares (40.4818, -3.364)  ≈ 30 km  → inside 100 km
  //   Valencia (39.4699, -0.3763)          ≈ 302 km → outside
  //   Barcelona (41.3874, 2.1686)          ≈ 505 km → outside
  //   Spain centre fallback (40.0, -3.5)   ≈ 49 km  → inside — MAP-17's point
  const MADRID = { latitude: 40.4168, longitude: -3.7038 };

  it("MAP-16: drops listings outside the chosen radius from every source", async () => {
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(
          makeWallapopResponse([
            makeWallapopItem({ id: "wp-near" }), // fixture default: Madrid, 0 km
            makeWallapopItem({
              id: "wp-far",
              location: {
                latitude: 41.3874,
                longitude: 2.1686,
                postal_code: "08001",
                city: "Barcelona",
                region: "Cataluña",
                country_code: "ES",
              },
            }),
          ]),
        ),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(
          makeCochesNetResponse([
            makeCochesNetItem({
              id: "cn-near",
              location: {
                provinceIds: [28],
                regionId: 13,
                regionLiteral: "Madrid",
                mainProvince: "Madrid",
                mainProvinceId: 28,
                cityId: 2807,
                cityLiteral: "Getafe",
              },
            }),
            makeCochesNetItem({ id: "cn-far" }), // fixture default: Barcelona
          ]),
        ),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(
          makeMilanunciosHtml(
            makeMilanunciosResponse([
              makeMilanunciosAd({
                id: "mn-near",
                location: {
                  city: { id: 1, name: "Alcalá de Henares", slug: "alcala" },
                  province: { id: 28, name: "Madrid", slug: "madrid" },
                  region: { id: 13, name: "Comunidad de Madrid", slug: "madrid" },
                },
              }),
              makeMilanunciosAd({ id: "mn-far" }), // fixture default: Oliva → Valencia
            ]),
          ),
        ),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "radius-drop",
        ...MADRID,
        distanceInKm: 100,
      });
    });

    const ids = result.current.listings.map((l) => l.id);
    expect(ids).toContain("wallapop-wp-near");
    expect(ids).toContain("cochesnet-cn-near");
    expect(ids).toContain("milanuncios-mn-near");
    expect(ids).not.toContain("wallapop-wp-far");
    expect(ids).not.toContain("cochesnet-cn-far");
    expect(ids).not.toContain("milanuncios-mn-far");
    expect(ids).toHaveLength(3);
  });

  it("MAP-16: applies the radius to pages appended by the scroll sentinel", async () => {
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        const isNextPage = new URL(request.url).searchParams.get("next_page") !== null;
        if (isNextPage) {
          // Page 2 is entirely outside the radius.
          return HttpResponse.json(
            makeWallapopResponse([
              makeWallapopItem({
                id: "wp-page2-far",
                location: {
                  latitude: 41.3874,
                  longitude: 2.1686,
                  postal_code: "08001",
                  city: "Barcelona",
                  region: "Cataluña",
                  country_code: "ES",
                },
              }),
            ]),
          );
        }
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem({ id: "wp-page1-near" })], "page-2"),
        );
      }),
      http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([], 0))),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "radius-paginate",
        ...MADRID,
        distanceInKm: 100,
      });
    });
    expect(result.current.listings.map((l) => l.id)).toEqual(["wallapop-wp-page1-near"]);

    act(() => result.current.sentinelRef(document.createElement("div")));
    await act(async () => {
      triggerIntersection();
    });

    // Page 2 had no further next_page, so exhaustion is the observable end of
    // the load — and its far-away item must not have been appended.
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.listings.map((l) => l.id)).toEqual(["wallapop-wp-page1-near"]);
  });

  it("MAP-16: leaves results unfiltered when no location is chosen", async () => {
    // Negative path: the same far-flung items survive when the user picked no
    // location — the radius must never apply to an unlocated search.
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(
          makeWallapopResponse([
            makeWallapopItem({
              id: "wp-bcn",
              location: {
                latitude: 41.3874,
                longitude: 2.1686,
                postal_code: "08001",
                city: "Barcelona",
                region: "Cataluña",
                country_code: "ES",
              },
            }),
          ]),
        ),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem({ id: "cn-bcn" })])),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(
          makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd({ id: "mn-oliva" })])),
        ),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "no-location-no-filter" });
    });

    expect(result.current.listings.map((l) => l.id)).toEqual([
      "wallapop-wp-bcn",
      "cochesnet-cn-bcn",
      "milanuncios-mn-oliva",
    ]);
  });

  it("MAP-18: drops listings that name the selected model neither in their model field nor in their title", async () => {
    // No location in this search — MAP-18 must hold on its own, not ride on
    // the radius filter. Milanuncios is the source that leaks: its model
    // filter is free-text upstream, and its normalised model is always "",
    // so only the title can prove a match. coches.net leaks only when its
    // model-name resolution fell back to make-only filtering.
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(
          makeWallapopResponse([
            makeWallapopItem({
              id: "wp-match",
              title: "BMW 320d",
              type_attributes: {
                brand: "BMW",
                model: "Serie 3",
                year: 2019,
                version: "320d",
                km: 120_000,
                engine: "gasoil",
                horsepower: 190,
              },
            }),
          ]),
        ),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(
          makeCochesNetResponse([
            makeCochesNetItem({ id: "cn-match" }), // fixture default: model "Serie 3"
            makeCochesNetItem({
              id: "cn-contradicts",
              title: "BMW Serie 5 530d",
              model: "Serie 5",
            }),
          ]),
        ),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(
          makeMilanunciosHtml(
            makeMilanunciosResponse([
              makeMilanunciosAd({
                id: "mn-match",
                title: "BMW Serie 3 318d Touring",
              }),
              makeMilanunciosAd({
                id: "mn-diluted",
                title: "BMW Serie 5 530d Luxury",
              }),
            ]),
          ),
        ),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "model-enforced",
        brand: "BMW",
        model: "Serie 3",
      });
    });

    const ids = result.current.listings.map((l) => l.id);
    expect(ids).toContain("wallapop-wp-match");
    expect(ids).toContain("cochesnet-cn-match");
    expect(ids).toContain("milanuncios-mn-match");
    expect(ids).not.toContain("cochesnet-cn-contradicts");
    expect(ids).not.toContain("milanuncios-mn-diluted");
    expect(ids).toHaveLength(3);
  });

  it("MAP-17: excludes listings pinned at the country-centre fallback even though it lies inside the radius", async () => {
    // Neither source recognises "Villarriba" or province id 99, so both geo
    // resolvers fall through to the Spain centre (40.0, -3.5) — which is only
    // ≈49 km from Madrid. A plain distance check would let these through; the
    // criterion is that an unresolvable location is excluded, not radius-checked.
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([]))),
      http.post(COCHESNET, () =>
        HttpResponse.json(
          makeCochesNetResponse([
            makeCochesNetItem({
              id: "cn-near",
              location: {
                provinceIds: [28],
                regionId: 13,
                regionLiteral: "Madrid",
                mainProvince: "Madrid",
                mainProvinceId: 28,
                cityId: 2807,
                cityLiteral: "Getafe",
              },
            }),
            makeCochesNetItem({
              id: "cn-unresolved",
              location: {
                provinceIds: [99],
                regionId: 99,
                regionLiteral: "Terra Incognita",
                mainProvince: "Terra Incognita",
                mainProvinceId: 99,
                cityId: 9999,
                cityLiteral: "Villarriba",
              },
            }),
          ]),
        ),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.json(
          makeMilanunciosResponse([
            makeMilanunciosAd({
              id: "mn-unresolved",
              location: {
                city: { id: 1, name: "Villarriba", slug: "villarriba" },
                province: { id: 99, name: "Terra Incognita", slug: "terra" },
                region: { id: 99, name: "Terra Incognita", slug: "terra" },
              },
              province: { id: 99, name: "Terra Incognita", slug: "terra" },
            }),
          ]),
        ),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "fallback-excluded",
        ...MADRID,
        distanceInKm: 100,
      });
    });

    expect(result.current.listings.map((l) => l.id)).toEqual(["cochesnet-cn-near"]);
  });
});

describe("useListingsSearch filtered-away pages", () => {
  const MADRID = { latitude: 40.4168, longitude: -3.7038 };
  const BARCELONA = {
    latitude: 41.3874,
    longitude: 2.1686,
    postal_code: "08001",
    city: "Barcelona",
    region: "Cataluña",
    country_code: "ES",
  };

  /** Only Wallapop pages; the other two return nothing and stay exhausted. */
  function onlyWallapop(handler: Parameters<typeof http.get>[1]): Parameters<typeof server.use> {
    return [
      http.get(WALLAPOP, handler),
      http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([], 0))),
      ),
    ];
  }

  it("MAP-19: keeps fetching when the first page is filtered away entirely", async () => {
    // Without this the empty state renders and MapView never mounts the
    // sentinel, so "no cars found" would be permanent while page 2 sits there.
    const pagesServed: string[] = [];
    server.use(
      ...onlyWallapop(({ request }) => {
        const next = new URL(request.url).searchParams.get("next_page");
        pagesServed.push(next ?? "first");
        if (next === "page-2") {
          return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "wp-madrid" })]));
        }
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem({ id: "wp-bcn", location: BARCELONA })], "page-2"),
        );
      }),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "first-page-empty",
        ...MADRID,
        distanceInKm: 100,
      });
    });

    expect(pagesServed).toEqual(["first", "page-2"]);
    expect(result.current.listings.map((l) => l.id)).toEqual(["wallapop-wp-madrid"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("MAP-19: keeps fetching when a page appended by the sentinel is filtered away entirely", async () => {
    // The stall the sentinel cannot recover from on its own: the list does not
    // grow, so it neither unmounts nor moves, and IntersectionObserver reports
    // crossings rather than states — nothing would ask for page 3.
    const pagesServed: string[] = [];
    server.use(
      ...onlyWallapop(({ request }) => {
        const next = new URL(request.url).searchParams.get("next_page");
        pagesServed.push(next ?? "first");
        if (next === "page-2") {
          return HttpResponse.json(
            makeWallapopResponse(
              [makeWallapopItem({ id: "wp-bcn", location: BARCELONA })],
              "page-3",
            ),
          );
        }
        if (next === "page-3") {
          return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "wp-getafe" })]));
        }
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem({ id: "wp-madrid" })], "page-2"),
        );
      }),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "later-page-empty",
        ...MADRID,
        distanceInKm: 100,
      });
    });
    expect(result.current.listings.map((l) => l.id)).toEqual(["wallapop-wp-madrid"]);

    act(() => result.current.sentinelRef(document.createElement("div")));
    await act(async () => {
      triggerIntersection();
    });

    await waitFor(() =>
      expect(result.current.listings.map((l) => l.id)).toEqual([
        "wallapop-wp-madrid",
        "wallapop-wp-getafe",
      ]),
    );
    expect(pagesServed).toEqual(["first", "page-2", "page-3"]);
  });

  it("MAP-19: stops once every source is exhausted rather than fetching forever", async () => {
    // The negative path, and the proof the loop terminates: two pages exist,
    // both filtered away, so the search ends empty and honest — no promise of
    // more, and exactly two requests.
    const pagesServed: string[] = [];
    server.use(
      ...onlyWallapop(({ request }) => {
        const next = new URL(request.url).searchParams.get("next_page");
        pagesServed.push(next ?? "first");
        return HttpResponse.json(
          makeWallapopResponse(
            [makeWallapopItem({ id: `wp-bcn-${next ?? "1"}`, location: BARCELONA })],
            next === "page-2" ? null : "page-2",
          ),
        );
      }),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({
        keywords: "all-pages-empty",
        ...MADRID,
        distanceInKm: 100,
      });
    });

    expect(pagesServed).toEqual(["first", "page-2"]);
    expect(result.current.listings).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useListingsSearch pagination guards", () => {
  it("MAP-10: does not fetch the same next page twice when the sentinel fires repeatedly", async () => {
    let pageRequests = 0;
    server.use(
      http.get(WALLAPOP, ({ request }) => {
        const isNextPage = new URL(request.url).searchParams.get("next_page") !== null;
        if (isNextPage) pageRequests += 1;
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem()], isNextPage ? null : "page-2"),
        );
      }),
      http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([], 0))),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "double-sentinel" });
    });
    act(() => result.current.sentinelRef(document.createElement("div")));

    // A fast scroll can fire the observer twice before the first fetch lands.
    await act(async () => {
      triggerIntersection();
      triggerIntersection();
    });

    expect(pageRequests).toBe(1);
  });
});

describe("useListingsSearch server action fan-out", () => {
  it("FRONT-3: one search round makes exactly one searchListings call, not three fetches", async () => {
    vi.mocked(searchListings).mockClear();
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "one-action-call" });
    });

    expect(searchListings).toHaveBeenCalledTimes(1);
  });
});

describe("useListingsSearch results generation (MAP-25)", () => {
  it("MAP-25: bumps the generation when a network search commits its first results, but not on loadMore", async () => {
    server.use(
      http.get(WALLAPOP, () =>
        HttpResponse.json(makeWallapopResponse([makeWallapopItem()], "page-2")),
      ),
      http.post(COCHESNET, () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 3)),
      ),
      http.get(MILANUNCIOS, () =>
        HttpResponse.html(makeMilanunciosHtml(makeMilanunciosResponse([makeMilanunciosAd()], 5))),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    expect(result.current.resultsGeneration).toBe(0);

    await act(async () => {
      await result.current.search({ keywords: "generation-network" });
    });
    expect(result.current.resultsGeneration).toBe(1);

    // loadMore appends a page; it must never bump the generation.
    act(() => result.current.sentinelRef(document.createElement("div")));
    await act(async () => {
      triggerIntersection();
    });
    await waitFor(() => expect(result.current.listings).toHaveLength(6));
    expect(result.current.resultsGeneration).toBe(1);
  });

  it("MAP-25: bumps the generation on a cache hit as well as on a fresh network search", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "generation-cache" });
    });
    expect(result.current.resultsGeneration).toBe(1);

    // Every endpoint fails now — a cache hit must still bump the generation
    // while never touching the network.
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({}, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({}, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({}, { status: 500 })),
    );

    await act(async () => {
      await result.current.search({ keywords: "generation-cache" });
    });
    expect(result.current.resultsGeneration).toBe(2);
  });
});
