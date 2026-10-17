import { describe, expect, it } from "vitest";
import { nextRadius, resultsState } from "./results-state";

// docs/specs/redesign-map.md (MAPUI-31 worked example «Empty state widening»).
describe("MAPUI-31: nextRadius", () => {
  it.each([
    [10, 25],
    [25, 50],
    [50, 100],
    [100, 200],
  ])("MAPUI-31: %i km widens to %i km", (radiusKm, widened) => {
    expect(nextRadius(radiusKm)).toBe(widened);
  });

  it("MAPUI-31: 200 km has no wider radius", () => {
    expect(nextRadius(200)).toBeUndefined();
  });
});

describe("MAPUI-30: resultsState", () => {
  it("MAPUI-30: the first page loading reads loading, even with an earlier error", () => {
    expect(resultsState(true, true, 0)).toBe("loading");
  });

  it("MAPUI-32: a failed search reads error", () => {
    expect(resultsState(false, true, 0)).toBe("error");
  });

  it("MAPUI-31: no listings reads empty", () => {
    expect(resultsState(false, false, 0)).toBe("empty");
  });

  it("MAPUI-30: listings read ready", () => {
    expect(resultsState(false, false, 3)).toBe("ready");
  });
});
