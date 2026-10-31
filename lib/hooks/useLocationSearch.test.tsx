import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeNominatimResult } from "@/test/fixtures/nominatim";
import type { NominatimResult } from "@/lib/geo/nominatim";
import { useLocationSearch } from "./useLocationSearch";

afterEach(() => vi.useRealTimers());

// The exposed `server.events` type only carries "on"/"removeListener"/
// "removeAllListeners", not "once", so a single-fire subscription needs
// manual unsubscribing.
function waitForNextMockedResponse(): Promise<void> {
  return new Promise((resolve) => {
    const onMocked = () => {
      server.events.removeListener("response:mocked", onMocked);
      resolve();
    };
    server.events.on("response:mocked", onMocked);
  });
}

/**
 * Installs a Nominatim handler whose `gatedQuery` (default `"Madr"`) blocks
 * until the returned `release()` is called, while every other query resolves
 * at once with `fallback`. `release()` unblocks the gate, then synchronises
 * on the response actually reaching the hook — MSW firing "response:mocked"
 * once it has resolved the gated request, the only one still pending —
 * rather than on the handler merely starting to unblock, then flushes the
 * microtasks that carry it through the hook's own `await response.json()`.
 *
 * `foreverQuery`, when given, never resolves at all — for simulating a
 * request whose response the test does not care about and will not wait on.
 */
function holdNominatimResponse(
  fallback: NominatimResult[],
  gatedQuery = "Madr",
  foreverQuery?: string,
) {
  let releaseGate: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });

  server.use(
    http.get("https://nominatim.openstreetmap.org/search", async ({ request }) => {
      const q = new URL(request.url).searchParams.get("q");
      if (q === foreverQuery) {
        return new Promise<Response>(() => {
          /* never resolves */
        });
      }
      if (q === gatedQuery) {
        await gate;
        return HttpResponse.json([makeNominatimResult()]);
      }
      return HttpResponse.json(fallback);
    }),
  );

  return async function release() {
    const gatedMocked = waitForNextMockedResponse();
    releaseGate?.();
    await act(async () => {
      await gatedMocked;
    });
    await act(async () => {
      // Empty on purpose: just flushing the microtasks queued by the
      // response:mocked event above before we assert on the hook's state.
    });
  };
}

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

    const release = holdNominatimResponse([
      makeNominatimResult({
        place_id: 2,
        display_name: "Madridejos, Castilla-La Mancha",
        lat: "39.4650",
        lon: "-3.5323",
        address: { city: "Madridejos", state: "Castilla-La Mancha" },
      }),
    ]);

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

    await release();

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

  it("MAP-20: a late response is discarded after the query is shortened below two characters", async () => {
    vi.useFakeTimers();

    const release = holdNominatimResponse([]);

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madr"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    act(() => result.current.setQuery("M"));

    await release();

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("MAP-20: an earlier response arriving while the latest search is still pending is discarded", async () => {
    vi.useFakeTimers();

    // "Madr" stays controllable so the test can release it once "Madri" is
    // the latest query; "Madri" never resolves, since this test never needs
    // it to — it only cares that the hook is still waiting on it.
    const release = holdNominatimResponse([], "Madr", "Madri");

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madr"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    act(() => result.current.setQuery("Madri"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    await release();

    // "Madr"'s response arrived after "Madri" became the latest query, so it
    // must not overwrite state, and the hook is still waiting on "Madri".
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(true);
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

  it("MAP-22: without unmounting, the debounce sends one request", async () => {
    vi.useFakeTimers();

    let calls = 0;
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    const requested = waitForNextMockedResponse();

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await requested;
    });

    expect(calls).toBe(1);
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

  it("clear() empties the query and results after a search", async () => {
    vi.useFakeTimers();
    const requested = waitForNextMockedResponse();

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await requested;
    });

    expect(result.current.results).toHaveLength(1);

    act(() => result.current.clear());

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  // MAPUI-56: "Dónde" has to tell a down place search apart from Nominatim
  // legitimately finding nothing, so the hook exposes a `failed` flag the
  // field reads instead of treating every empty `results` the same way.
  describe("MAPUI-56: the failed flag", () => {
    it("MAPUI-56: is true once a search's request fails", async () => {
      vi.useFakeTimers();
      server.use(
        http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.error()),
      );
      const { result } = renderHook(() => useLocationSearch());

      act(() => result.current.setQuery("Madrid"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.failed).toBe(true);
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });

    it("MAPUI-56: is false again after a search that succeeds", async () => {
      vi.useFakeTimers();
      let fail = true;
      server.use(
        http.get("https://nominatim.openstreetmap.org/search", () =>
          fail ? HttpResponse.error() : HttpResponse.json([]),
        ),
      );
      const { result } = renderHook(() => useLocationSearch());

      act(() => result.current.setQuery("Madrid"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(result.current.failed).toBe(true);

      fail = false;
      act(() => result.current.setQuery("Madri"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.failed).toBe(false);
    });

    it("MAPUI-56: is false again once the query shortens below two characters", async () => {
      vi.useFakeTimers();
      server.use(
        http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.error()),
      );
      const { result } = renderHook(() => useLocationSearch());

      act(() => result.current.setQuery("Madrid"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(result.current.failed).toBe(true);

      act(() => result.current.setQuery("M"));

      expect(result.current.failed).toBe(false);
    });

    it("MAPUI-56: an out-of-order failure is discarded, like a late success", async () => {
      vi.useFakeTimers();

      // "Madr" stays controllable and fails once released; "Madri" never
      // resolves, since this test only cares that the hook is still waiting
      // on it when "Madr"'s stale failure arrives.
      let releaseGate: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
      server.use(
        http.get("https://nominatim.openstreetmap.org/search", async ({ request }) => {
          const q = new URL(request.url).searchParams.get("q");
          if (q === "Madri")
            return new Promise<Response>(() => {
              /* never resolves */
            });
          await gate;
          return HttpResponse.error();
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

      await act(async () => {
        releaseGate?.();
        await gate;
      });
      // Flushes the rejected fetch through the hook's catch block, without
      // depending on MSW's "response:mocked" event — HttpResponse.error()
      // simulates a network failure, not a mocked response.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // "Madr"'s failure arrived after "Madri" became the latest query, so
      // it must not flip `failed`, and the hook is still waiting on "Madri".
      expect(result.current.failed).toBe(false);
      expect(result.current.isSearching).toBe(true);
    });
  });

  it("MAP-20: clearing while a search is pending discards its late response", async () => {
    vi.useFakeTimers();

    const release = holdNominatimResponse([], "Madrid");

    const { result } = renderHook(() => useLocationSearch());

    act(() => result.current.setQuery("Madrid"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    act(() => result.current.clear());

    await release();

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  // docs/specs/redesign-map.md (MAPUI-81): PlaceField's own hook for acting on
  // a request Enter was pressed on while it was pending, following the same
  // out-of-order guard as `results`/`failed` above.
  describe("MAPUI-81: onSettled", () => {
    it("MAPUI-81: fires once with the mapped results on success", async () => {
      vi.useFakeTimers();
      const onSettled = vi.fn();
      const { result } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madrid"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled).toHaveBeenCalledWith([
        { placeId: 1, displayName: "Madrid, Comunidad de Madrid", lat: 40.4168, lng: -3.7038 },
      ]);
    });

    it("MAPUI-81: fires once with an empty array on failure", async () => {
      vi.useFakeTimers();
      server.use(
        http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.error()),
      );
      const onSettled = vi.fn();
      const { result } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madrid"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled).toHaveBeenCalledWith([]);
    });

    it("MAPUI-81: fires only for the latest query, never for one a later query superseded", async () => {
      vi.useFakeTimers();
      const onSettled = vi.fn();
      const release = holdNominatimResponse([makeNominatimResult()]);
      const { result } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madr"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      act(() => result.current.setQuery("Madri"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled).toHaveBeenCalledWith([
        { placeId: 1, displayName: "Madrid, Comunidad de Madrid", lat: 40.4168, lng: -3.7038 },
      ]);

      onSettled.mockClear();
      await release();

      expect(onSettled).not.toHaveBeenCalled();
    });

    it("MAPUI-81: is not called once the query is shortened below two characters while pending", async () => {
      vi.useFakeTimers();
      const onSettled = vi.fn();
      const release = holdNominatimResponse([]);
      const { result } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madr"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      act(() => result.current.setQuery("M"));

      await release();

      expect(onSettled).not.toHaveBeenCalled();
    });

    it("MAPUI-81: is not called after unmounting before the debounce fires", async () => {
      vi.useFakeTimers();
      const onSettled = vi.fn();
      const { result, unmount } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madrid"));
      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(onSettled).not.toHaveBeenCalled();
    });

    it("MAPUI-81: is not called when unmounted after the debounce fires, once the held request resolves", async () => {
      vi.useFakeTimers();
      const onSettled = vi.fn();
      const release = holdNominatimResponse([makeNominatimResult()], "Madr");
      const { result, unmount } = renderHook(() => useLocationSearch("es", onSettled));

      act(() => result.current.setQuery("Madr"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      unmount();
      await release();

      expect(onSettled).not.toHaveBeenCalled();
    });
  });
});
