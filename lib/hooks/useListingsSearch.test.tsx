import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import {
  makeCochesNetItem,
  makeCochesNetResponse,
} from "@/test/fixtures/cochesnet";
import {
  makeMilanunciosAd,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";
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

    expect(result.current.listings.map((l) => l.source)).toEqual([
      "Coches.net",
      "Milanuncios",
    ]);
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
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
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
          return HttpResponse.json(
            makeWallapopResponse([makeWallapopItem({ id: "stale" })]),
          );
        }
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem({ id: "fresh" })]),
        );
      }),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json(makeCochesNetResponse([])),
      ),
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
        HttpResponse.json(
          makeWallapopResponse([makeWallapopItem()], "page-2"),
        ),
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
      wrapper: ({ children }) => (
        <I18nProvider locale="es">{children}</I18nProvider>
      ),
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
      wrapper: ({ children }) => (
        <I18nProvider locale="es">{children}</I18nProvider>
      ),
    });

    await act(async () => {
      await result.current.search({ keywords: "localised-invalid", latitude: 999 });
    });

    // Previously this surfaced the raw Zod issue message, which is English
    // prose written for developers.
    expect(toast.error).toHaveBeenCalledWith(
      "Esos filtros de búsqueda no son válidos.",
    );
  });
});

describe("useListingsSearch pagination guards", () => {
  it("MAP-10: does not fetch the same next page twice when the sentinel fires repeatedly", async () => {
    let pageRequests = 0;
    server.use(
      http.get("*/api/wallapop/search", ({ request }) => {
        const isNextPage =
          new URL(request.url).searchParams.get("next_page") !== null;
        if (isNextPage) pageRequests += 1;
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem()], isNextPage ? null : "page-2"),
        );
      }),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json(makeCochesNetResponse([], 0)),
      ),
      http.get("*/api/milanuncios/search", () =>
        HttpResponse.json(makeMilanunciosResponse([], 0)),
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
