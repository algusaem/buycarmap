import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCarModels } from "./useCarModels";

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

describe("useCarModels", () => {
  it("does not fetch and reports no models when no brand is selected", () => {
    const { result } = renderHook(() => useCarModels(""));
    expect(result.current).toEqual({ models: [], isLoading: false });
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

  it("resolves to an empty list when the request fails", async () => {
    vi.mocked(listCarModels).mockRejectedValueOnce(new Error("network error"));
    const { result } = renderHook(() => useCarModels("BMW"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.models).toEqual([]);
  });
});

describe("useCarModels server action", () => {
  it("FRONT-4: calls listCarModels and makes no /api/... request", async () => {
    vi.mocked(listCarModels).mockClear();
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
