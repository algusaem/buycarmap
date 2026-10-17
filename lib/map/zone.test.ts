import { describe, expect, it } from "vitest";
import { alertMapZone } from "./zone";

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
