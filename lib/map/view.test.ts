import { describe, expect, it } from "vitest";
import { boundsOf, formatMapCenter, formatMapNumber } from "./view";

// docs/specs/map-maplibre.md (Contracts › Test hooks): the view each map
// writes on its container for the e2e tests (MAPLIBRE-3, MAPLIBRE-4).
describe("MAPLIBRE-3: formatMapNumber — 2 decimals, trailing zeros trimmed", () => {
  it.each([
    [5, "5"],
    [5.5, "5.5"],
    [13.456, "13.46"],
    [13.454, "13.45"],
    [0, "0"],
    [-0, "0"],
    [-12.3, "-12.3"],
    [6.999, "7"],
  ])("MAPLIBRE-3: %d reads «%s»", (value, expected) => {
    expect(formatMapNumber(value)).toBe(expected);
  });
});

describe("MAPLIBRE-3: formatMapCenter — «lat,lng» to 4 decimals", () => {
  it("MAPLIBRE-3: Madrid's centre reads «40.4168,-3.7038»", () => {
    expect(formatMapCenter(40.41679999, -3.70380001)).toBe("40.4168,-3.7038");
  });

  it("MAPLIBRE-3: a round coordinate keeps its 4 decimals", () => {
    expect(formatMapCenter(40, -3.5)).toBe("40.0000,-3.5000");
  });
});

describe("MAPLIBRE-7: boundsOf — the bounds a fit takes", () => {
  it("MAPLIBRE-7: Madrid, Barcelona and Seville span -5.9845..2.1686 by 37.3891..41.3874", () => {
    expect(
      boundsOf([
        [-3.7038, 40.4168],
        [2.1686, 41.3874],
        [-5.9845, 37.3891],
      ]),
    ).toEqual([
      [-5.9845, 37.3891],
      [2.1686, 41.3874],
    ]);
  });

  it("MAPLIBRE-7: one point is its own bounds", () => {
    expect(boundsOf([[-3.7038, 40.4168]])).toEqual([
      [-3.7038, 40.4168],
      [-3.7038, 40.4168],
    ]);
  });
});
