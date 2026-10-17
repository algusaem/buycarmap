import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ pathname: "/map", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

import { useCurrentPath } from "./useCurrentPath";

// docs/specs/redesign-map.md, worked example "Sign-in return (MAPUI-37,
// MAPUI-46; bug fix)".
describe("useCurrentPath", () => {
  it("MAPUI-37: on /map?make=Toyota&maxPrice=20000 it is the path with its query", () => {
    navigation.pathname = "/map";
    navigation.query = "make=Toyota&maxPrice=20000";

    const { result } = renderHook(() => useCurrentPath());

    expect(result.current).toBe("/map?make=Toyota&maxPrice=20000");
  });

  it("MAPUI-37: with no query it is the path alone, with no trailing ?", () => {
    navigation.pathname = "/favorites";
    navigation.query = "";

    const { result } = renderHook(() => useCurrentPath());

    expect(result.current).toBe("/favorites");
  });
});
