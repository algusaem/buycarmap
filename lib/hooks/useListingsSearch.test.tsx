import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import {
  makeCochesNetItem,
  makeCochesNetResponse,
} from "@/test/fixtures/cochesnet";
import { triggerIntersection } from "@/test/mocks/intersection-observer";
import { useListingsSearch } from "./useListingsSearch";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
import { toast } from "sonner";

afterEach(() => vi.clearAllMocks());

describe("useListingsSearch", () => {
  it("interleaves Wallapop and coches.net results and sets hasMore", async () => {
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "interleave-case" });
    });

    // Default handlers return one item per source; interleave alternates them.
    expect(result.current.listings.map((l) => l.source)).toEqual([
      "Wallapop",
      "Coches.net",
    ]);
    // wallapop next_page "page-2" and coches.net totalPages 3 → more available.
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("still renders one source when the other fails", async () => {
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "partial-failure" });
    });

    expect(result.current.listings).toHaveLength(1);
    expect(result.current.listings[0].source).toBe("Coches.net");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts and renders nothing when both sources fail", async () => {
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
      http.post("*/api/cochesnet/search", () =>
        HttpResponse.json({ error: "down" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "both-fail" });
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

    // Both endpoints now fail — a cache hit means we never touch them.
    server.use(
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
      http.post("*/api/cochesnet/search", () =>
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
    );
    const { result } = renderHook(() => useListingsSearch());

    await act(async () => {
      await result.current.search({ keywords: "paginate" });
    });
    expect(result.current.listings).toHaveLength(2);

    // Attach the sentinel, then simulate it scrolling into view.
    act(() => result.current.sentinelRef(document.createElement("div")));
    await act(async () => {
      triggerIntersection();
    });

    await waitFor(() => expect(result.current.listings).toHaveLength(4));
  });
});
