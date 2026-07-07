import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "@/test/msw/server";
import { useCarModels } from "./useCarModels";

describe("useCarModels", () => {
  it("does not fetch and reports no models when no brand is selected", () => {
    const { result } = renderHook(() => useCarModels(""));
    expect(result.current).toEqual({ models: [], isLoading: false });
  });

  it("loads the brand's models, showing loading while in flight", async () => {
    const { result } = renderHook(() => useCarModels("Audi"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.models).toEqual([{ id: "A3", title: "A3" }]);
  });

  it("resolves to an empty model list when the request fails", async () => {
    server.use(
      http.get("*/api/wallapop/filters/models", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCarModels("BMW"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.models).toEqual([]);
  });
});
