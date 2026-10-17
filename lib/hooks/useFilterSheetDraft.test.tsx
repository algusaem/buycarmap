import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFilterSheetDraft } from "./useFilterSheetDraft";

// docs/specs/redesign-map.md (MAPUI-18, MAPUI-22): the phone filters
// sheet keeps its choices in a draft until «Ver coches».

describe("useFilterSheetDraft", () => {
  it("MAPUI-22: starts from the search and hands over its panel criteria, not the place", () => {
    const { result } = renderHook(() =>
      useFilterSheetDraft({ maxPrice: 20000, latitude: 40.4168, longitude: -3.7038 }),
    );

    expect(result.current.draft).toEqual({
      maxPrice: 20000,
      latitude: 40.4168,
      longitude: -3.7038,
    });
    expect(result.current.criteria()).toEqual({ maxPrice: 20000 });
  });

  it("MAPUI-22: an edit changes only the draft's patched criteria", () => {
    const { result } = renderHook(() => useFilterSheetDraft({ maxPrice: 20000 }));

    act(() => result.current.edit({ engine: ["gasoil"] }));

    expect(result.current.criteria()).toEqual({ maxPrice: 20000, engine: ["gasoil"] });
  });

  it("MAPUI-22: «Borrar» empties every panel criterion, the hidden ones included, and drops the `?q=` text", () => {
    const { result } = renderHook(() =>
      useFilterSheetDraft({ maxPrice: 20000, minHorsePower: 100, keywords: "golf" }),
    );

    act(() => result.current.clear());

    expect(result.current.draft.maxPrice).toBeUndefined();
    expect(result.current.draft.minHorsePower).toBeUndefined();
    expect(result.current.criteria()).toEqual({ keywords: "" });
  });

  it("MAPUI-18: without «Borrar», the `?q=` text is not handed over", () => {
    const { result } = renderHook(() => useFilterSheetDraft({ keywords: "golf" }));

    expect(result.current.criteria()).toEqual({});
    expect(Object.hasOwn(result.current.criteria(), "keywords")).toBe(false);
  });
});
