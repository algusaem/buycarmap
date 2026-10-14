import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter, withNuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ChipKey } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";

// Geolocation is a dependency of the mount sequence, not a thing these tests
// are about — except MAP-14, which needs to control exactly when it resolves.
// The default is an already-resolved promise, which is what jsdom produces
// anyway (permission denied), so every other test behaves as before.
const geo = vi.hoisted(() => ({
  resolve: () => {
    /* placeholder default: MAP-14 replaces this with the real resolve function */
  },
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

describe("useSearchFilters removeChip (MAPUI-13, MAPUI-22)", () => {
  const removals: [ChipKey, Partial<SearchInput>][] = [
    ["engine:hybrid", { engine: ["gasoil", "cng"] }],
    ["engine:gasoil", { engine: ["hybride", "hybride_plugin", "cng"] }],
    ["price", { minPrice: undefined, maxPrice: undefined }],
    ["minPrice", { minPrice: undefined }],
    ["maxPrice", { maxPrice: undefined }],
    ["gearbox", { gearbox: ["semiautomatic"] }],
    ["maxKm", { maxKm: undefined }],
    ["minYear", { minYear: undefined }],
    ["timeFilter", { timeFilter: undefined }],
    ["brand", { brand: undefined, model: undefined }],
  ];

  it.each(removals)(
    "MAPUI-13: removing the %s chip clears only that criterion and searches at once",
    async (key, cleared) => {
      const { search, result } = await renderFromFullUrl();
      search.mockClear();

      act(() => result.current.removeChip(key));

      // No timer advanced: a removed chip skips the MAP-11 pause.
      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenLastCalledWith({ ...FULL_SEARCH, ...cleared });
    },
  );
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
});
