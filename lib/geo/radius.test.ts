import { describe, expect, it } from "vitest";
import { makeMatchListing } from "@/test/fixtures/alerts";
import { filterByRadius, haversineKm } from "./radius";

describe("haversineKm", () => {
  it("measures one degree of latitude as ~111.19 km", () => {
    // Hand-derived: a meridian is 2π × 6371 km ≈ 40030.17 km around, so one
    // degree along it is 40030.17 / 360 ≈ 111.195 km.
    expect(haversineKm(40, -3.7038, 41, -3.7038)).toBeCloseTo(111.19, 1);
  });

  it("returns zero for identical points", () => {
    expect(haversineKm(40.4168, -3.7038, 40.4168, -3.7038)).toBe(0);
  });
});

describe("filterByRadius", () => {
  // Madrid centre; Getafe is ≈12 km away, Barcelona ≈505 km.
  const madrid = { latitude: 40.4168, longitude: -3.7038 };
  const getafe = makeMatchListing({ id: "near", lat: 40.3088, lng: -3.7328 });
  const barcelona = makeMatchListing({ id: "far", lat: 41.3874, lng: 2.1686 });

  it("keeps listings inside the radius and drops those outside", () => {
    const result = filterByRadius([getafe, barcelona], {
      keywords: "",
      ...madrid,
      distanceInKm: 50,
    });
    expect(result.map((l) => l.id)).toEqual(["near"]);
  });

  it("treats the radius as inclusive at the boundary", () => {
    // (41, 0) is ≈111.195 km due north of (40, 0) — hand-derived above.
    const boundary = makeMatchListing({ id: "boundary", lat: 41, lng: 0 });
    const centre = { keywords: "", latitude: 40, longitude: 0 };

    expect(
      filterByRadius([boundary], { ...centre, distanceInKm: 111.2 }),
    ).toHaveLength(1);
    expect(
      filterByRadius([boundary], { ...centre, distanceInKm: 111.1 }),
    ).toHaveLength(0);
  });

  it("drops a country-centre fallback pin even when it is inside the radius", () => {
    // The fallback point (40.0, -3.5) is ≈49 km from Madrid — inside a 100 km
    // radius — but it means "location unknown", not "in Guadalajara province".
    const unresolved = makeMatchListing({ id: "unknown", lat: 40.0, lng: -3.5 });
    const result = filterByRadius([unresolved, getafe], {
      keywords: "",
      ...madrid,
      distanceInKm: 100,
    });
    expect(result.map((l) => l.id)).toEqual(["near"]);
  });

  it("filters nothing when no location was chosen", () => {
    const result = filterByRadius([getafe, barcelona], { keywords: "" });
    expect(result).toEqual([getafe, barcelona]);
  });

  it("filters nothing when a location lacks a radius", () => {
    const result = filterByRadius([barcelona], { keywords: "", ...madrid });
    expect(result).toEqual([barcelona]);
  });
});
