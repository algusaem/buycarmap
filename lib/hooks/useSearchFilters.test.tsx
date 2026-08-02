import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSearchFilters } from "./useSearchFilters";

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

  it("debounces filter updates by 400ms before searching", async () => {
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

  it("triggerSearch searches immediately, bypassing the debounce", () => {
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
