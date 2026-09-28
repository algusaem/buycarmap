import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { useLocationSearch } from "./useLocationSearch";

afterEach(() => vi.useRealTimers());

describe("useLocationSearch", () => {
  it("does not search for queries shorter than 2 characters", () => {
    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("M"));

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("debounces, geocodes, and exposes mapped results", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));
    expect(result.current.isSearching).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.results[0]).toEqual({
      placeId: 1,
      displayName: "Madrid, Comunidad de Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAP-20: a late response for an earlier query is discarded", async () => {
    vi.useFakeTimers();

    let releaseMadr: (() => void) | undefined;
    const madrGate = new Promise<void>((resolve) => {
      releaseMadr = resolve;
    });
    let resolveMadrServed: (() => void) | undefined;
    const madrServed = new Promise<void>((resolve) => {
      resolveMadrServed = resolve;
    });

    server.use(
      http.get("https://nominatim.openstreetmap.org/search", async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q === "Madr") {
          await madrGate;
          resolveMadrServed?.();
          return HttpResponse.json([
            {
              place_id: 1,
              display_name: "Madrid, España",
              lat: "40.4168",
              lon: "-3.7038",
              address: { city: "Madrid", state: "Comunidad de Madrid" },
            },
          ]);
        }
        return HttpResponse.json([
          {
            place_id: 2,
            display_name: "Madridejos, Castilla-La Mancha",
            lat: "39.4650",
            lon: "-3.5323",
            address: { city: "Madridejos", state: "Castilla-La Mancha" },
          },
        ]);
      }),
    );

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madr"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    act(() => result.current.setQuery("Madri"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.results).toEqual([
      {
        placeId: 2,
        displayName: "Madridejos, Castilla-La Mancha",
        lat: 39.465,
        lng: -3.5323,
      },
    ]);

    releaseMadr?.();
    await act(async () => {
      await madrServed;
    });

    // The "Madr" response resolved after "Madri"'s, but it must not overwrite
    // the later query's results.
    expect(result.current.results).toEqual([
      {
        placeId: 2,
        displayName: "Madridejos, Castilla-La Mancha",
        lat: 39.465,
        lng: -3.5323,
      },
    ]);
    expect(result.current.isSearching).toBe(false);
  });

  it("MAP-22: unmounting before the debounce fires sends no request", async () => {
    vi.useFakeTimers();

    let calls = 0;
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    const { result, unmount } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(calls).toBe(0);
  });

  it("clears the query and results", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.clear());

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
  });
});
