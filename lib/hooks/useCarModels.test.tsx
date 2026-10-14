import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { clearCarModelsCache, useCarModels, useModelNames } from "./useCarModels";

// FRONT-4 (docs/specs/core-frontend.md): useCarModels calls the
// listCarModels Server Action instead of fetching the (now-deleted)
// /api/wallapop/filters/models proxy.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({
    ok: true,
    value: [{ id: "A3", label: "A3" }],
  })),
}));
import { listCarModels } from "@/server/search/actions";

// The models are cached for the session (docs/specs/redesign-map.md ›
// Contracts › Brand list), so each test starts from an empty cache and a
// fresh call count.
beforeEach(() => {
  clearCarModelsCache();
  vi.mocked(listCarModels).mockClear();
});

describe("useCarModels", () => {
  it("does not fetch and reports no models when no brand is selected", () => {
    const { result } = renderHook(() => useCarModels(""));
    expect(result.current).toEqual({ models: [], isLoading: false });
    expect(listCarModels).not.toHaveBeenCalled();
  });

  it("loads the brand's models, showing loading while in flight", async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "A3", label: "A3" }],
    });
    const { result } = renderHook(() => useCarModels("Audi"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.models).toEqual([{ id: "A3", label: "A3" }]);
  });

  it("MAPUI-10: resolves to an empty list when the request fails", async () => {
    vi.mocked(listCarModels).mockRejectedValueOnce(new Error("network error"));
    const { result } = renderHook(() => useCarModels("BMW"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.models).toEqual([]);
  });
});

describe("useCarModels server action", () => {
  it("FRONT-4: calls listCarModels and makes no /api/... request", async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "A3", label: "A3" }],
    });

    const { result } = renderHook(() => useCarModels("Seat"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listCarModels).toHaveBeenCalledWith("Seat");
    expect(result.current.models).toEqual([{ id: "A3", label: "A3" }]);
  });
});

// docs/specs/redesign-map.md (Contracts › Brand list): "cached per brand in
// the page's hook for the session, and deduplicated by name ignoring case".
describe("useCarModels session cache (MAPUI-6)", () => {
  it("MAPUI-6: Toyota, then Seat, then Toyota again asks listCarModels twice", async () => {
    const { result, rerender } = renderHook(({ brand }) => useCarModels(brand), {
      initialProps: { brand: "Toyota" },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ brand: "Seat" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ brand: "Toyota" });
    expect(result.current.isLoading).toBe(false);

    expect(listCarModels).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listCarModels).mock.calls.map(([brand]) => brand)).toEqual(["Toyota", "Seat"]);
  });

  it("MAPUI-6: a brand another type-ahead already loaded is not asked for again", async () => {
    const first = renderHook(() => useCarModels("Toyota"));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    const second = renderHook(() => useCarModels("Toyota"));

    expect(second.result.current.isLoading).toBe(false);
    expect(listCarModels).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-6: the labels Corolla, COROLLA and Yaris give Corolla and Yaris", async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [
        { id: "Corolla", label: "Corolla" },
        { id: "123", label: "COROLLA" },
        { id: "Yaris", label: "Yaris" },
      ],
    });

    const { result } = renderHook(() => useModelNames(["Toyota"]));

    await waitFor(() => expect(result.current).toEqual([["Corolla", "Yaris"]]));
  });

  it("MAPUI-10: a failed request is not cached, so asking again for the brand refetches", async () => {
    vi.mocked(listCarModels).mockRejectedValueOnce(new Error("network error"));
    const failed = renderHook(() => useCarModels("Toyota"));
    await waitFor(() => expect(failed.result.current.isLoading).toBe(false));
    expect(failed.result.current.models).toEqual([]);
    failed.unmount();

    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "Corolla", label: "Corolla" }],
    });
    const retried = renderHook(() => useCarModels("Toyota"));

    await waitFor(() => expect(retried.result.current.isLoading).toBe(false));
    expect(retried.result.current.models).toEqual([{ id: "Corolla", label: "Corolla" }]);
    expect(listCarModels).toHaveBeenCalledTimes(2);
  });

  it("MAPUI-10: an error Result is not cached either", async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: false,
      error: { code: "rateLimited", messageKey: "errors.rateLimited" },
    });
    const failed = renderHook(() => useCarModels("Seat"));
    await waitFor(() => expect(failed.result.current.isLoading).toBe(false));
    failed.unmount();

    const retried = renderHook(() => useCarModels("Seat"));
    await waitFor(() => expect(retried.result.current.isLoading).toBe(false));

    expect(listCarModels).toHaveBeenCalledTimes(2);
  });
});
