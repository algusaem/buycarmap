import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetItem, makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { makeMilanunciosAd, makeMilanunciosResponse } from "@/test/fixtures/milanuncios";
import { triggerIntersection } from "@/test/mocks/intersection-observer";
import { I18nProvider } from "@/lib/i18n/client";
import { useListingsSearch } from "./useListingsSearch";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
// I18nProvider refreshes the route when the locale changes; MAP-7 wraps the
// hook in one to assert the failure copy comes from the locale files.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import { toast } from "sonner";

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
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "partial-failure" });
    });

    expect(result.current.listings.map((l) => l.source)).toEqual(["Coches.net", "Milanuncios"]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("MAP-3: toasts and renders nothing when every source fails", async () => {
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "all-fail" });
    });

    expect(result.current.listings).toEqual([]);
    // No I18nProvider here, so useTranslation falls back to the default locale,
    // which is Spanish. MAP-7 covers the localisation itself.
    expect(toast.error).toHaveBeenCalledWith(
      "No se pudieron cargar los anuncios. Inténtalo de nuevo.",
    );
  });

  it("MAP-5: serves a repeated identical search from cache without refetching", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "cache-hit" });
    });
    const first = result.current.listings;

    // Every endpoint now fails — a cache hit means we never touch them.
    server.use(
      http.get("*/api/wallapop/search", () => HttpResponse.json({}, { status: 500 })),
      http.post("*/api/cochesnet/search", () => HttpResponse.json({}, { status: 500 })),
      http.get("*/api/milanuncios/search", () => HttpResponse.json({}, { status: 500 })),
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
      http.get("*/api/wallapop/search", async () => {
        call += 1;
        if (call === 1) {
          await delay(80); // the stale, slow first search
          return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "stale" })]));
        }
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem({ id: "fresh" })]));
      }),
      http.post("*/api/cochesnet/search", () => HttpResponse.json(makeCochesNetResponse([]))),
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
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json(makeWallapopResponse([makeWallapopItem()], "page-2")),
      ),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem()], 3)),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(makeMilanunciosResponse([makeMilanunciosAd()], 5)),
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
      http.get("*/api/wallapop/search", record),
      http.post("*/api/cochesnet/search", record),
      http.get("*/api/milanuncios/search", record),
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

  it("MAP-7: reports a failed search in the user's language", async () => {
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useListingsSearch(), {
      wrapper: ({ children }) => <I18nProvider locale="es">{children}</I18nProvider>,
    });

    await act(async () => {
      await result.current.search({ keywords: "localised-failure" });
    });

    // Hand-derived from lib/i18n/locales/es.ts. The point of the assertion is
    // that the copy comes from the locale file at all: this path used to show
    // a hardcoded English string to a user whose default language is Spanish.
    expect(toast.error).toHaveBeenCalledWith(
      "No se pudieron cargar los anuncios. Inténtalo de nuevo.",
    );
  });

  it("MAP-7: reports invalid filters in the user's language", async () => {
    const { result } = renderHook(() => useListingsSearch(), {
      wrapper: ({ children }) => <I18nProvider locale="es">{children}</I18nProvider>,
    });

    await act(async () => {
      await result.current.search({ keywords: "localised-invalid", latitude: 999 });
    });

    // Previously this surfaced the raw Zod issue message, which is English
    // prose written for developers.
    expect(toast.error).toHaveBeenCalledWith("Esos filtros de búsqueda no son válidos.");
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
      http.get("*/api/wallapop/search", () =>
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
      http.post("*/api/cochesnet/search", () =>
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
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(
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
      http.get("*/api/wallapop/search", ({ request }) => {
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
      http.post("*/api/cochesnet/search", () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get("*/api/milanuncios/search", () => HttpResponse.json(makeMilanunciosResponse([], 0))),
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
      http.get("*/api/wallapop/search", () =>
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
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json(makeCochesNetResponse([makeCochesNetItem({ id: "cn-bcn" })])),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(makeMilanunciosResponse([makeMilanunciosAd({ id: "mn-oliva" })])),
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
      http.get("*/api/wallapop/search", () =>
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
      http.post("*/api/cochesnet/search", () =>
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
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(
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
      http.get("*/api/wallapop/search", () => HttpResponse.json(makeWallapopResponse([]))),
      http.post("*/api/cochesnet/search", () =>
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
      http.get("*/api/milanuncios/search", () =>
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
      http.get("*/api/wallapop/search", handler),
      http.post("*/api/cochesnet/search", () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get("*/api/milanuncios/search", () => HttpResponse.json(makeMilanunciosResponse([], 0))),
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
      http.get("*/api/wallapop/search", ({ request }) => {
        const isNextPage = new URL(request.url).searchParams.get("next_page") !== null;
        if (isNextPage) pageRequests += 1;
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem()], isNextPage ? null : "page-2"),
        );
      }),
      http.post("*/api/cochesnet/search", () => HttpResponse.json(makeCochesNetResponse([], 0))),
      http.get("*/api/milanuncios/search", () => HttpResponse.json(makeMilanunciosResponse([], 0))),
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
