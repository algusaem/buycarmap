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
