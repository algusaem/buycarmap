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
import { useListingsSearch } from "./useListingsSearch";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
import { toast } from "sonner";

afterEach(() => vi.clearAllMocks());

describe("useListingsSearch", () => {
  it("interleaves all three sources and sets hasMore", async () => {
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

  it("still renders the remaining sources when one fails", async () => {
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

  it("toasts and renders nothing when every source fails", async () => {
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
    expect(toast.error).toHaveBeenCalledWith("Failed to fetch listings");
  });

  it("serves a repeated identical search from cache without refetching", async () => {
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

  it("discards a stale response that resolves after a newer search", async () => {
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

  it("appends the next page when the scroll sentinel intersects", async () => {
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
