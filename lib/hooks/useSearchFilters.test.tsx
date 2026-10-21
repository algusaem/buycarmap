import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter, withNuqsTestingAdapter } from "nuqs/adapters/testing";
import type { SearchInput } from "@/lib/search/schema";

// Geolocation is a dependency of the mount sequence, not a thing these tests
// are about — except the geolocation cases (MAP-14, MAP-28 to MAP-37), which
// control when it resolves and what it answers. The default is an
// already-resolved promise, which is what jsdom produces anyway (permission
// denied), so every other test behaves as before.
const geo = vi.hoisted(() => ({
  resolve: () => {
    /* placeholder default: a geolocation case replaces this with the real resolve function */
  },
  promise: Promise.resolve(),
  // The browser's position (MAP-28 to MAP-35): null until a test sets it,
  // mirroring jsdom's own denial-by-default.
  position: null as { lat: number; lng: number } | null,
  init: vi.fn(),
  // MAP-37: what the real dismissUserLocation does — the position is gone for
  // the rest of the document, a remount included.
  dismissed: false,
  dismiss: vi.fn(() => {
    geo.dismissed = true;
  }),
}));
vi.mock("@/lib/geo/user-location", () => ({
  initUserGeolocation: geo.init,
  waitForGeolocation: () => geo.promise,
  getUserLocation: () => (geo.dismissed ? null : geo.position),
  dismissUserLocation: geo.dismiss,
}));

import { useSearchFilters } from "./useSearchFilters";

beforeEach(() => {
  geo.promise = Promise.resolve();
  geo.position = null;
  geo.init.mockClear();
  geo.dismissed = false;
  geo.dismiss.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("useSearchFilters", () => {
  it("fires an immediate search on mount with the Spain-center fallback params", () => {
    const search = vi.fn();
    renderHook(() => useSearchFilters(search, () => ""), { wrapper: withNuqsTestingAdapter() });

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
    renderHook(() => useSearchFilters(search, () => "golf"), { wrapper: withNuqsTestingAdapter() });

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ keywords: "golf" }));
  });

  it("MAP-11: debounces filter updates by 400ms before searching", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
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
    const { result } = renderHook(() => useSearchFilters(search, () => "kw"), {
      wrapper: withNuqsTestingAdapter(),
    });
    search.mockClear();

    act(() => result.current.updateInput({ minPrice: 5000 }));
    act(() => result.current.triggerSearch());

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: "kw", minPrice: 5000 }),
    );
  });
});

describe("useSearchFilters panel visibility", () => {
  it("starts collapsed", () => {
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("collapses the panel when a search is triggered", () => {
    // The results sit behind the expanded panel, so leaving it open after an
    // explicit search hides the very thing the user asked for.
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.setFiltersOpen(true));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.triggerSearch());

    expect(result.current.isOpen).toBe(false);
  });

  it("still searches when the panel was already closed", () => {
    // Triggering from the search box with no panel open must behave normally.
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "golf"), {
      wrapper: withNuqsTestingAdapter(),
    });
    search.mockClear();

    act(() => result.current.triggerSearch());

    expect(result.current.isOpen).toBe(false);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ keywords: "golf" }));
  });

  it("leaves the panel open while filters are being adjusted", () => {
    // `update()` re-searches on every change. Collapsing there would shut the
    // panel the moment someone picked a brand, mid-edit.
    vi.useFakeTimers();
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.setFiltersOpen(true));
    act(() => result.current.setBrand("Audi"));
    act(() => vi.advanceTimersByTime(500));

    expect(result.current.isOpen).toBe(true);
  });

  it("leaves the panel open when filters are cleared", () => {
    // Clearing is an editing action, not a "show me the results" action.
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.setFiltersOpen(true));
    act(() => result.current.clearAll());

    expect(result.current.isOpen).toBe(true);
  });
});

describe("useSearchFilters filter coupling", () => {
  it("MAP-12: clears the selected model when the brand changes", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
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
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The radius has a default of 50, but it is meaningless without a centre —
    // sending it alone would narrow a search the user never located.
    act(() => result.current.setDistanceInKm(200));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ distanceInKm: undefined }));

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
    renderHook(() => useSearchFilters(search, () => ""), { wrapper: withNuqsTestingAdapter() });

    // The first search must not wait on geolocation: a permission prompt the
    // user ignores would otherwise leave the map empty indefinitely.
    expect(search).toHaveBeenCalledTimes(1);

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    // Re-run so the source clients pick up the now-known position, which is
    // what stops Wallapop geo-filtering by the server's IP.
    expect(search).toHaveBeenCalledTimes(2);
    // MAP-28: the re-run is centred on the position, at the 50 km default.
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );
  });

  it("MAP-14: does not override a location the user chose first", async () => {
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
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
    const withUserPosition = search.mock.calls.filter(([params]) => params.latitude !== 41.3874);
    expect(withUserPosition).toEqual([]);
  });

  it("MAP-28: centres the search on the browser's position with a 50 km radius, keeping the filters chosen meanwhile", async () => {
    vi.useFakeTimers();
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    // The model is chosen while the browser's prompt is still unanswered.
    act(() => result.current.setModel("Corolla"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 40.42,
        longitude: -3.7,
        distanceInKm: 50,
        model: "Corolla",
      }),
    );
  });

  it("MAP-29: with no position, the national first search is the only search", async () => {
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    renderHook(() => useSearchFilters(search, () => ""), { wrapper: withNuqsTestingAdapter() });

    // The browser answers with no position (denied, or timed out).
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );
  });

  it("MAP-30: a location in the URL means the browser is never asked and only the deep-linked search runs", async () => {
    // Even though the browser would answer with a position, a deep-linked
    // place is a decision already made (MAP-30) — the prompt must never fire.
    geo.position = { lat: 40.42, lng: -3.7 };
    const search = vi.fn<(params: SearchInput) => void>();
    renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?lat=41.3874&lng=2.1686&placeId=1&locationName=Barcelona",
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(geo.init).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 41.3874, longitude: 2.1686, distanceInKm: 50 }),
    );
  });

  it("MAP-37: a place in the URL at load also ends the position for the visit", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    const search = vi.fn<(params: SearchInput) => void>();
    renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?lat=41.3874&lng=2.1686&placeId=1&locationName=Barcelona",
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(geo.dismiss).toHaveBeenCalledTimes(1);
    expect(geo.init).not.toHaveBeenCalled();
  });

  it("MAP-31: «Toda España» chosen while the position is pending wins over a position arriving later", async () => {
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.applyInput({}, null));
    await act(async () => {
      await Promise.resolve();
    });

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    const withLatitude = search.mock.calls.filter(([params]) => params.latitude !== undefined);
    expect(withLatitude).toEqual([]);
    expect(result.current.selectedLocation).toBeUndefined();
    expect(result.current.browserPosition).toBeUndefined();
  });

  it("MAP-14: a place chosen while the position is pending wins over a position arriving later", async () => {
    vi.useFakeTimers();
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    const withPosition = search.mock.calls.filter(([params]) => params.latitude === 40.42);
    expect(withPosition).toEqual([]);
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 41.3874, longitude: 2.1686 }),
    );
    expect(result.current.browserPosition).toBeUndefined();
  });

  it("MAP-32: «Quitar filtros» keeps the position standing in", async () => {
    vi.useFakeTimers();
    geo.position = { lat: 40.42, lng: -3.7 };
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.setModel("Corolla"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.clearAll());

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 40.42,
        longitude: -3.7,
        distanceInKm: 50,
        model: undefined,
      }),
    );
  });

  it("MAP-13: once the position stands in for a location, the chosen radius is sent around it", async () => {
    vi.useFakeTimers();
    geo.position = { lat: 40.42, lng: -3.7 };
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.setDistanceInKm(100));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 100 }),
    );
  });

  it("MAP-33: the position and a radius chosen around it never reach the URL", async () => {
    vi.useFakeTimers();
    geo.position = { lat: 40.42, lng: -3.7 };
    const search = vi.fn<(params: SearchInput) => void>();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    // A radius alone around the position changes nothing the URL records, so
    // it pushes no history entry. The MAP-11 pause, then the URL update it
    // would queue.
    act(() => result.current.setDistanceInKm(100));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, distanceInKm: 100 }),
    );
    expect(onUrlUpdate).not.toHaveBeenCalled();

    // With a filter the URL does record, it is written...
    act(() => result.current.setDistanceInKm(25));
    act(() => result.current.setModel("Corolla"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, distanceInKm: 25, model: "Corolla" }),
    );
    expect(onUrlUpdate).toHaveBeenCalled();
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("model")).toBe("Corolla");
    // ...yet neither the position nor the radius around it ever reached it.
    for (const call of onUrlUpdate.mock.calls) {
      const qs = call[0].searchParams.toString();
      expect(qs).not.toMatch(/lat=|lng=|placeId=|locationName=|radius=/);
    }
  });

  it("MAP-33: with no place, the radius never reaches the URL", async () => {
    vi.useFakeTimers();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });
    await act(async () => {
      await Promise.resolve();
    });

    // No place and no position: the radius alone is not written. The MAP-11
    // pause, then the URL update it would queue.
    act(() => result.current.setDistanceInKm(25));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    for (const call of onUrlUpdate.mock.calls) {
      expect(call[0].searchParams.toString()).not.toContain("radius=");
    }

    // A place chosen at that radius carries it.
    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.toString()).toContain("radius=25");
  });

  it("MAP-33: a radius left over after «Toda España» is not written", async () => {
    vi.useFakeTimers();
    const search = vi.fn<(params: SearchInput) => void>();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Madrid",
        lat: 40.4168,
        lng: -3.7038,
      }),
    );
    act(() => result.current.setDistanceInKm(100));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.toString()).toContain("radius=100");

    act(() => result.current.setLocation(undefined));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const qs = onUrlUpdate.mock.lastCall?.[0].searchParams.toString();
    expect(qs).not.toMatch(/radius=|lat=|lng=|placeId=|locationName=/);
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );
  });

  it("MAP-38: a search whose URL would not change adds no history entry", async () => {
    vi.useFakeTimers();
    const search = vi.fn<(params: SearchInput) => void>();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      // With memory, as the browser keeps the URL a commit wrote.
      wrapper: withNuqsTestingAdapter({ onUrlUpdate, hasMemory: true }),
    });
    await act(async () => {
      await Promise.resolve();
    });

    // A filter committed with «Buscar»: one URL update.
    act(() => result.current.updateInput({ maxPrice: 20000 }));
    act(() => result.current.triggerSearch());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    search.mockClear();

    // «Buscar» again with nothing changed: it searches, the URL stays put.
    act(() => result.current.triggerSearch());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ maxPrice: 20000 }));
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
  });

  it("MAP-31: «Toda España» from the desktop popover while the position is pending wins", async () => {
    vi.useFakeTimers();
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    const { result } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.setLocation(undefined));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    const withLatitude = search.mock.calls.filter(([params]) => params.latitude !== undefined);
    expect(withLatitude).toEqual([]);
    expect(result.current.browserPosition).toBeUndefined();
  });

  it("MAP-28: the geolocated search is at 50 km even if the URL carried another radius", async () => {
    pendingGeolocation();
    const search = vi.fn<(params: SearchInput) => void>();
    // An old link's radius with no place: it meant nothing without one.
    renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?radius=100" }),
    });

    geo.position = { lat: 40.42, lng: -3.7 };
    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );
  });

  it("MAP-37: after a place is chosen, remounting the map does not bring the position back", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    const first = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(first.result.current.browserPosition).toEqual({ lat: 40.42, lng: -3.7 });

    act(() =>
      first.result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    expect(geo.dismiss).toHaveBeenCalledTimes(1);
    first.unmount();

    // Back on /map through a nav link: a remount in the same document, no reload.
    const search = vi.fn<(params: SearchInput) => void>();
    const second = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    const withLatitude = search.mock.calls.filter(([params]) => params.latitude !== undefined);
    expect(withLatitude).toEqual([]);
    expect(second.result.current.browserPosition).toBeUndefined();
  });

  it("MAP-21: does not re-search after unmounting before geolocation resolves", async () => {
    pendingGeolocation();
    const search = vi.fn();
    const { unmount } = renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    unmount();

    await act(async () => {
      geo.resolve();
      await geo.promise;
    });

    expect(search).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/redesign-map.md (MAPUI-12, the timing half — the component half,
// SearchPill's own "Buscar" closing its popover, is tested in
// components/map/search/SearchPill.test.tsx). The desktop popovers need a
// single "which one is open" state the hook owns, the same way `isOpen`
// already owns the filters panel's; the spec names no hook API for it, so
// the hook exposes `activePopover` ("where" | "car" | "price"
// | null), closed by `triggerSearch` exactly as `isOpen` already is.
describe("useSearchFilters popovers (MAPUI-12)", () => {
  it("MAPUI-12: starts with no popover open", () => {
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    expect(result.current.activePopover).toBeNull();
  });

  it("MAPUI-12: triggerSearch closes whichever popover is open, the same way it closes the filters panel", () => {
    const { result } = renderHook(() => useSearchFilters(vi.fn(), () => ""), {
      wrapper: withNuqsTestingAdapter(),
    });

    act(() => result.current.setActivePopover("price"));
    expect(result.current.activePopover).toBe("price");

    act(() => result.current.triggerSearch());

    expect(result.current.activePopover).toBeNull();
  });
});

// docs/specs/redesign-map.md (MAPUI-18): «Borrar» and «Quitar filtros» go
// through `clearAll`, which also drops the landing's `?q=` text — from the
// search it runs, from the ones after it, and from the URL.
describe("useSearchFilters clearAll and the ?q= text (MAPUI-18)", () => {
  it("MAPUI-18: clearAll searches without the q text and removes q from the URL", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "golf"), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?q=golf", onUrlUpdate }),
    });
    await act(async () => {
      await Promise.resolve();
    });
    search.mockClear();

    act(() => result.current.clearAll());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(search).toHaveBeenLastCalledWith({ keywords: "" });
    expect(onUrlUpdate).toHaveBeenCalled();
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.has("q")).toBe(false);
  });

  it("MAPUI-18: after clearAll, a later filter change still searches without the q text", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "golf"), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?q=golf" }),
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.clearAll());
    act(() => result.current.updateInput({ maxPrice: 20000 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: "", maxPrice: 20000 }),
    );
  });
});

// docs/specs/redesign-map.md (MAPUI-12, MAPUI-13, MAPUI-18, MAPUI-19,
// MAPUI-21, MAPUI-22): the redesigned controls' entry points. Every case
// starts from the same deep link, carrying every criterion (including the
// ones the UI no longer offers, MAPUI-18) and a place, so each expectation
// shows exactly which criteria a call changes and which it leaves alone.
const FULL_URL =
  "?q=golf&engine=gasoil,hybride,hybride_plugin,cng&gearbox=manual,semiautomatic" +
  "&make=Toyota&model=Corolla&minPrice=3000&maxPrice=20000&minKm=1000&maxKm=100000" +
  "&minYear=2015&maxYear=2020&minHorsePower=90&maxHorsePower=200&timeFilter=today" +
  "&lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid&radius=25";

/** The search the full deep link runs, field by field. */
const FULL_SEARCH: SearchInput = {
  keywords: "golf",
  engine: ["gasoil", "hybride", "hybride_plugin", "cng"],
  gearbox: ["manual", "semiautomatic"],
  brand: "Toyota",
  model: "Corolla",
  minPrice: 3000,
  maxPrice: 20000,
  minKm: 1000,
  maxKm: 100000,
  minYear: 2015,
  maxYear: 2020,
  minHorsePower: 90,
  maxHorsePower: 200,
  timeFilter: "today",
  latitude: 40.4168,
  longitude: -3.7038,
  distanceInKm: 25,
};

async function renderFromFullUrl(onUrlUpdate = vi.fn()) {
  vi.useFakeTimers();
  const search = vi.fn();
  const view = renderHook(() => useSearchFilters(search, () => "golf"), {
    wrapper: withNuqsTestingAdapter({ searchParams: FULL_URL, onUrlUpdate }),
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { search, onUrlUpdate, result: view.result };
}

describe("useSearchFilters deep link (MAPUI-18)", () => {
  it("MAPUI-18: the full deep link reaches the mount search with every criterion, the removed ones included", async () => {
    const { search } = await renderFromFullUrl();

    expect(search).toHaveBeenCalledWith(FULL_SEARCH);
  });
});

describe("useSearchFilters clearAll (MAPUI-18, MAPUI-19, MAPUI-31)", () => {
  it("MAPUI-19: «Borrar» clears every panel criterion and the removed ones at once, keeping the place and its radius", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() => result.current.clearAll());

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith({
      keywords: "",
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 25,
    });
  });

  it("MAPUI-18: «Borrar» drops q and the cleared criteria from the URL, and keeps the place", async () => {
    const { onUrlUpdate, result } = await renderFromFullUrl();

    act(() => result.current.clearAll());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const params = onUrlUpdate.mock.lastCall?.[0].searchParams;
    expect(params?.has("q")).toBe(false);
    expect(params?.has("make")).toBe(false);
    expect(params?.has("minKm")).toBe(false);
    expect(params?.has("engine")).toBe(false);
    expect(params?.get("locationName")).toBe("Madrid");
    expect(params?.get("radius")).toBe("25");
  });
});

describe("useSearchFilters applyInput (MAPUI-21, MAPUI-22)", () => {
  it("MAPUI-21: «Ver coches» applies the sheet's criteria at once and «Toda España» (null) clears the place", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() =>
      result.current.applyInput({ brand: "Seat", model: undefined, maxPrice: 15000 }, null),
    );

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith({
      ...FULL_SEARCH,
      brand: "Seat",
      model: undefined,
      maxPrice: 15000,
      latitude: undefined,
      longitude: undefined,
      distanceInKm: undefined,
    });
  });

  it("MAPUI-21: a place passed in replaces the current one; leaving it out keeps it", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() => result.current.applyInput({ minPrice: undefined }));
    expect(search).toHaveBeenLastCalledWith({ ...FULL_SEARCH, minPrice: undefined });

    act(() =>
      result.current.applyInput(
        { distanceInKm: 100 },
        { placeId: 2, displayName: "Sevilla", lat: 37.3891, lng: -5.9845 },
      ),
    );
    expect(search).toHaveBeenLastCalledWith({
      ...FULL_SEARCH,
      minPrice: undefined,
      latitude: 37.3891,
      longitude: -5.9845,
      distanceInKm: 100,
    });
  });

  it("MAPUI-22: the phone panel's cleared fuel, gearbox and listed time read as no criterion", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() =>
      result.current.applyInput({
        engine: undefined,
        gearbox: undefined,
        timeFilter: undefined,
        distanceInKm: undefined,
      }),
    );

    // An undefined radius leaves the radius in force (25 km), not the default.
    expect(search).toHaveBeenLastCalledWith({
      ...FULL_SEARCH,
      engine: undefined,
      gearbox: undefined,
      timeFilter: undefined,
    });
  });

  it("MAPUI-18: an emptied text drops q from this search and the ones after it", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() => result.current.applyInput({ keywords: "" }));
    act(() => result.current.applyInput({ maxPrice: 18000 }));

    expect(search).toHaveBeenNthCalledWith(1, { ...FULL_SEARCH, keywords: "" });
    expect(search).toHaveBeenNthCalledWith(2, { ...FULL_SEARCH, keywords: "", maxPrice: 18000 });
  });
});

describe("useSearchFilters updateInput (MAPUI-12)", () => {
  it("MAPUI-12: a desktop change searches only after the MAP-11 pause, with just the keys it names changed", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() =>
      result.current.updateInput({
        gearbox: ["automatic"],
        timeFilter: "lastWeek",
        minKm: undefined,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith({
      ...FULL_SEARCH,
      gearbox: ["automatic"],
      timeFilter: "lastWeek",
      minKm: undefined,
    });
  });

  it("MAPUI-12: a cleared brand also clears its model, and an emptied text drops q", async () => {
    const { search, result } = await renderFromFullUrl();
    search.mockClear();

    act(() => result.current.updateInput({ keywords: "", brand: undefined, model: undefined }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(search).toHaveBeenLastCalledWith({
      ...FULL_SEARCH,
      keywords: "",
      brand: undefined,
      model: undefined,
    });
  });
});

// docs/specs/redesign-map.md, worked example "«Quitar filtros» (MAPUI-31)":
// the place and the radius stay, every filter and the text go. The worked
// example's URL carries no `placeId`, which lib/search/url-state.ts needs to
// read a place at all, so `placeId=1` is added on both sides.
describe("useSearchFilters «Quitar filtros» (MAPUI-31)", () => {
  it("MAPUI-31: the worked example keeps the place and the radius and drops every filter and the text", async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useSearchFilters(search, () => "golf"), {
      wrapper: withNuqsTestingAdapter({
        searchParams:
          "?lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid&radius=25&engine=gasoil&maxPrice=20000&q=golf",
        onUrlUpdate,
      }),
    });
    await act(async () => {
      await Promise.resolve();
    });
    search.mockClear();

    act(() => result.current.clearAll());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(search).toHaveBeenLastCalledWith({
      keywords: "",
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 25,
    });
    const params = onUrlUpdate.mock.lastCall?.[0].searchParams;
    expect(params?.get("lat")).toBe("40.4168");
    expect(params?.get("lng")).toBe("-3.7038");
    expect(params?.get("placeId")).toBe("1");
    expect(params?.get("locationName")).toBe("Madrid");
    expect(params?.get("radius")).toBe("25");
    expect(params?.has("engine")).toBe(false);
    expect(params?.has("maxPrice")).toBe(false);
    expect(params?.has("q")).toBe(false);
  });
});

// docs/specs/redesign-map.md, worked example "Gearbox (MAPUI-16)".
describe("useSearchFilters gearbox (MAPUI-16)", () => {
  async function mountSearchFor(searchParams: string) {
    const search = vi.fn<(params: SearchInput) => void>();
    renderHook(() => useSearchFilters(search, () => ""), {
      wrapper: withNuqsTestingAdapter({ searchParams }),
    });
    await act(async () => {
      await Promise.resolve();
    });
    return search.mock.calls[0][0];
  }

  it("MAPUI-16: gearbox=manual,automatic (an old link) sends no gearbox criterion", async () => {
    expect((await mountSearchFor("?gearbox=manual,automatic")).gearbox).toBeUndefined();
  });

  it("MAPUI-16: gearbox=manual sends manual", async () => {
    expect((await mountSearchFor("?gearbox=manual")).gearbox).toEqual(["manual"]);
  });
});

// FRONT-13 / MAPUI-18 / MAPUI-31: Back and Forward change the URL from
// outside the hook. The testing adapter re-reads its `searchParams` prop
// when it changes (with `hasMemory`), so re-rendering with a new query string
// stands in for the browser restoring an earlier entry.
describe("useSearchFilters Back/Forward", () => {
  function renderWithUrl(initialUrl: string, getKeywords: () => string) {
    vi.useFakeTimers();
    const search = vi.fn<(params: SearchInput) => void>();
    const onUrlUpdate = vi.fn();
    let url = initialUrl;
    const view = renderHook(() => useSearchFilters(search, getKeywords), {
      wrapper: ({ children }) => (
        <NuqsTestingAdapter searchParams={url} hasMemory onUrlUpdate={onUrlUpdate}>
          {children}
        </NuqsTestingAdapter>
      ),
    });
    async function goTo(nextUrl: string) {
      url = nextUrl;
      view.rerender();
      await act(async () => {
        await Promise.resolve();
      });
    }
    return { search, onUrlUpdate, result: view.result, goTo };
  }

  it("MAPUI-18: Back after «Quitar filtros» restores the q text search along with the filters", async () => {
    const { search, result, goTo } = renderWithUrl("?q=golf&maxPrice=20000", () => "golf");
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.clearAll());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(search).toHaveBeenLastCalledWith({ keywords: "" });

    // Back to the entry before the clear (the same query, in the order the
    // browser happens to restore it).
    await goTo("?maxPrice=20000&q=golf");

    expect(search).toHaveBeenLastCalledWith({ keywords: "golf", maxPrice: 20000 });
  });

  it("FRONT-13: Back while a change waits out the MAP-11 pause cancels it, so it neither searches nor pushes a history entry", async () => {
    const { search, onUrlUpdate, result, goTo } = renderWithUrl("?maxPrice=20000", () => "");
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.updateInput({ maxPrice: 30000 }));
    await goTo("?maxPrice=10000");
    search.mockClear();
    onUrlUpdate.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(search).not.toHaveBeenCalled();
    expect(onUrlUpdate).not.toHaveBeenCalled();
    expect(result.current.maxPrice).toBe(10000);
  });

  it("MAP-37: once a place is chosen, Back to an entry with no place runs the national search, not the position", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    const { search, result, goTo } = renderWithUrl("", () => "");
    await act(async () => {
      await Promise.resolve();
    });
    // The geolocated search ran: the position stood in for a place.
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    // The MAP-11 pause, then the URL update it queues.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 41.3874, longitude: 2.1686 }),
    );

    // Back to the entry with no place («?» rather than "", so the adapter
    // sees a new URL to restore, as the browser's Back would hand it one).
    await goTo("?");

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: undefined,
        longitude: undefined,
        distanceInKm: undefined,
      }),
    );
    expect(result.current.browserPosition).toBeUndefined();
  });

  it("MAP-37: with no choice made, Back to an entry with no place keeps the position", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    const { search, onUrlUpdate, result, goTo } = renderWithUrl("", () => "");
    await act(async () => {
      await Promise.resolve();
    });
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    act(() => result.current.setModel("Corolla"));
    // The MAP-11 pause, then the URL update it queues.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?model=Corolla");

    await goTo("?");

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 40.42,
        longitude: -3.7,
        distanceInKm: 50,
        model: undefined,
      }),
    );
    expect(result.current.browserPosition).toEqual({ lat: 40.42, lng: -3.7 });
  });

  it("MAP-28: an old ?radius= restored by Back while the position stands in is searched at 50 km", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    // Without the «?», so restoring «?radius=200» below is a new string the
    // adapter reads, as the browser's Back would hand it one.
    const { search, result, goTo } = renderWithUrl("radius=200", () => "");
    await act(async () => {
      await Promise.resolve();
    });
    // The geolocated search: the default radius, not the link's 200 km.
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    act(() => result.current.setBrand("Toyota"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await goTo("?radius=200");

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 40.42, distanceInKm: 50, brand: undefined }),
    );
    expect(result.current.distanceInKm).toBe(50);
  });

  it("MAP-37: Forward to an entry with a place drops the position", async () => {
    geo.position = { lat: 40.42, lng: -3.7 };
    const { search, result, goTo } = renderWithUrl("", () => "");
    await act(async () => {
      await Promise.resolve();
    });
    // The position stands in for a place.
    expect(result.current.browserPosition).toEqual({ lat: 40.42, lng: -3.7 });

    act(() =>
      result.current.setLocation({
        placeId: 1,
        displayName: "Barcelona",
        lat: 41.3874,
        lng: 2.1686,
      }),
    );
    // The MAP-11 pause, then the URL update it queues.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Back to the entry with no place, then Forward to the Barcelona one.
    await goTo("?");
    await goTo("?lat=41.3874&lng=2.1686&placeId=1&locationName=Barcelona");

    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 41.3874, longitude: 2.1686, distanceInKm: 50 }),
    );
    expect(result.current.browserPosition).toBeUndefined();
  });
});
