import { describe, expect, it } from "vitest";
import { alertMapZone, zoneBounds, zoneRing } from "./zone";

// docs/specs/redesign-alerts.md (ALERTUI-14, ALERTUI-16, ALERTUI-22): the
// zone an alert's map draws, read off its stored criteria. Madrid's point is
// 40.4168, -3.7038. The default radius is «Dónde»'s middle option, 50 km
// (lib/search/radii.ts: 10, 25, 50, 100, 200), the one searchSchema fills in
// for a point stored with no radius (MAP-27).
describe("ALERTUI-14: alertMapZone", () => {
  it("ALERTUI-14: a point and a radius are the zone — Madrid, 25 km", () => {
    expect(alertMapZone({ latitude: 40.4168, longitude: -3.7038, distanceInKm: 25 })).toEqual({
      lat: 40.4168,
      lng: -3.7038,
      radiusKm: 25,
    });
  });

  it("ALERTUI-14: a point with no radius is the zone at 50 km", () => {
    expect(alertMapZone({ latitude: 40.4168, longitude: -3.7038 })).toEqual({
      lat: 40.4168,
      lng: -3.7038,
      radiusKm: 50,
    });
  });

  it.each([
    ["no point", { brand: "BMW", maxPrice: 20000 }],
    ["a latitude alone", { latitude: 40.4168, distanceInKm: 25 }],
    ["a longitude alone", { longitude: -3.7038, distanceInKm: 25 }],
  ])("ALERTUI-14: criteria with %s have no zone", (_case, criteria) => {
    expect(alertMapZone(criteria)).toBeUndefined();
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-14); docs/specs/map-maplibre.md
// (MAPLIBRE-6): the zone's circle as the polygon MapLibre draws. Worked by
// hand for Madrid (40.4168, -3.7038) at 50 km, with the Earth's mean radius
// 6371 km: the angular radius is 50 / 6371 = 0.0078481 rad = 0.449661°, so
// due north and due south the ring is 0.449661° of latitude away at the same
// longitude. Due east, at this latitude, the longitude moves by about
// 0.449661° / cos(40.4168°) = 0.449661 / 0.76135 = 0.5906°, and the latitude
// dips to 40.4153° (the great circle bends back toward the equator).
describe("ALERTUI-14: zoneRing — the zone's circle", () => {
  const MADRID_50 = { lat: 40.4168, lng: -3.7038, radiusKm: 50 };

  it("ALERTUI-14: has 64 vertices, the first repeated at the end to close it", () => {
    const ring = zoneRing(MADRID_50);
    expect(ring).toHaveLength(65);
    expect(ring[64]).toEqual(ring[0]);
  });

  it("ALERTUI-14: the first vertex is due north, 50 km away: latitude 40.8665", () => {
    const [lng, lat] = zoneRing(MADRID_50)[0];
    expect(lat).toBeCloseTo(40.8665, 4);
    expect(lng).toBeCloseTo(-3.7038, 6);
  });

  it("ALERTUI-14: vertex 32 is due south: latitude 39.9671", () => {
    const [lng, lat] = zoneRing(MADRID_50)[32];
    expect(lat).toBeCloseTo(39.9671, 4);
    expect(lng).toBeCloseTo(-3.7038, 6);
  });

  it("ALERTUI-14: vertex 16 is due east: longitude -3.1132, latitude 40.4153", () => {
    const [lng, lat] = zoneRing(MADRID_50)[16];
    expect(lng).toBeCloseTo(-3.1132, 3);
    expect(lat).toBeCloseTo(40.4153, 3);
  });

  it("ALERTUI-14: the bounds span the ring: -4.2944..-3.1132 by 39.9671..40.8665", () => {
    const [[west, south], [east, north]] = zoneBounds(MADRID_50);
    expect(west).toBeCloseTo(-4.2944, 3);
    expect(east).toBeCloseTo(-3.1132, 3);
    expect(south).toBeCloseTo(39.9671, 4);
    expect(north).toBeCloseTo(40.8665, 4);
  });
});
