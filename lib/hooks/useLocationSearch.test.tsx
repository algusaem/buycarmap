import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
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
