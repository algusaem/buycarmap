import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Geolocation is a dependency of the mount sequence, not a thing these tests
// are about — except MAP-14, which needs to control exactly when it resolves.
// The default is an already-resolved promise, which is what jsdom produces
// anyway (permission denied), so every other test behaves as before.
const geo = vi.hoisted(() => ({
  resolve: () => {},
  promise: Promise.resolve(),
}));
vi.mock("@/lib/geo/user-location", () => ({
  initUserGeolocation: vi.fn(),
  waitForGeolocation: () => geo.promise,
  getUserLocation: () => null,
}));

import { useSearchFilters } from "./useSearchFilters";

beforeEach(() => {
  geo.promise = Promise.resolve();
});
afterEach(() => vi.useRealTimers());

describe("useSearchFilters", () => {
  it("fires an immediate search on mount with the Spain-center fallback params", () => {
    const search = vi.fn();
    renderHook(() => useSearchFilters(search, () => ""));

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: "",
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );
  });

  it("includes the initial keyword from getKeywords in the mount search", () => {
    // A landing-page search seeds the map via /map?q=... — the keyword must be
    // carried into the very first search, not dropped in favour of "".
    const search = vi.fn();
    renderHook(() => useSearchFilters(search, () => "golf"));

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: "golf" }),
    );
  });

  it("MAP-11: debounces filter updates by 400ms before searching", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""));
    // Flush the mount's post-geolocation re-search microtask, then isolate.
    await act(async () => {
      await Promise.resolve();
    });
    search.mockClear();

    act(() => result.current.setBrand("Audi"));
    expect(search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // toParams() maps a blank model to undefined, not "".
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ brand: "Audi", model: undefined }),
    );
  });

  it("MAP-11: triggerSearch searches immediately, bypassing the debounce", () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "kw"));
    search.mockClear();

    act(() => result.current.setMinPrice(5000));
    act(() => result.current.triggerSearch());

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: "kw", minPrice: 5000 }),
    );
  });

  it("tracks the active filter count", () => {
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""));

    expect(result.current.activeCount).toBe(0);
    act(() => result.current.setEngine(["gasoil"]));
    expect(result.current.activeCount).toBe(1);
    act(() => result.current.setMinPrice(1000));
    expect(result.current.activeCount).toBe(2);
  });
});

describe("useSearchFilters panel visibility", () => {
  it("starts collapsed", () => {
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""));

    expect(result.current.isOpen).toBe(false);
  });

  it("toggles open and closed", () => {
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""));

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it("collapses the panel when a search is triggered", () => {
    // The results sit behind the expanded panel, so leaving it open after an
    // explicit search hides the very thing the user asked for.
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""));

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.triggerSearch());

    expect(result.current.isOpen).toBe(false);
  });

  it("still searches when the panel was already closed", () => {
    // Triggering from the search box with no panel open must behave normally.
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "golf"));
    search.mockClear();

    act(() => result.current.triggerSearch());

    expect(result.current.isOpen).toBe(false);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: "golf" }),
    );
  });

  it("leaves the panel open while filters are being adjusted", () => {
    // `update()` re-searches on every change. Collapsing there would shut the
    // panel the moment someone picked a brand, mid-edit.
    vi.useFakeTimers();
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""));

    act(() => result.current.toggle());
    act(() => result.current.setBrand("Audi"));
    act(() => vi.advanceTimersByTime(500));

    expect(result.current.isOpen).toBe(true);
  });

  it("leaves the panel open when filters are cleared", () => {
    // Clearing is an editing action, not a "show me the results" action.
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""));

    act(() => result.current.toggle());
    act(() => result.current.clearAll());

    expect(result.current.isOpen).toBe(true);
  });
});

describe("useSearchFilters filter coupling", () => {
  it("MAP-12: clears the selected model when the brand changes", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.setBrand("Audi"));
    act(() => result.current.setModel("A3"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ brand: "Audi", model: "A3" }),
    );

    // A model id only means anything within its brand, so carrying "A3" over to
    // BMW would either match nothing or match something unintended.
    act(() => result.current.setBrand("BMW"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.model).toBe("");
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ brand: "BMW", model: undefined }),
    );
  });

  it("MAP-13: sends no radius until a location is chosen", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""));
    await act(async () => {
      await Promise.resolve();
    });

    // The radius has a default of 50, but it is meaningless without a centre —
    // sending it alone would narrow a search the user never located.
    act(() => result.current.setDistanceInKm(200));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ distanceInKm: undefined }),
    );

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Madrid",
        lat: 40.4168,
        lng: -3.7038,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 40.4168,
        longitude: -3.7038,
        distanceInKm: 200,
      }),
    );
  });
});

describe("useSearchFilters geolocation", () => {
  function pendingGeolocation() {
    geo.promise = new Promise<void>((resolve) => {
      geo.resolve = resolve;
    });
  }

  it("MAP-14: searches once immediately, then again when the position arrives", async () => {
    pendingGeolocation();
    const search = vi.fn();
    renderHook(() => useSearchFilters(search, () => ""));

    // The first search must not wait on geolocation: a permission prompt the
    // user ignores would otherwise leave the map empty indefinitely.
    expect(search).toHaveBeenCalledTimes(1);

    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    // Re-run so the source clients pick up the now-known position, which is
    // what stops Wallapop geo-filtering by the server's IP.
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("MAP-14: does not override a location the user chose first", async () => {
    pendingGeolocation();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""));
    search.mockClear();

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    // An explicit choice outranks the browser's guess; re-searching here would
    // silently drag the map back to wherever the user physically is.
    const withUserPosition = search.mock.calls.filter(
      ([params]) => params.latitude !== 41.3874,
    );
    expect(withUserPosition).toEqual([]);
  });
});
