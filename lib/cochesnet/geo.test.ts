import { describe, expect, it } from "vitest";
import { resolveCochesNetCoords } from "./geo";
import { CochesNetLocation } from "@/interfaces/cochesnet";

function location(overrides: Partial<CochesNetLocation>): CochesNetLocation {
  return {
    provinceIds: [],
    regionId: 0,
    regionLiteral: "",
    mainProvince: "",
    mainProvinceId: 0,
    cityId: 0,
    cityLiteral: "",
    ...overrides,
  };
}

describe("resolveCochesNetCoords", () => {
  it("resolves an exact city match first", () => {
    const coords = resolveCochesNetCoords(location({ cityLiteral: "Valencia" }));
    expect(coords).toEqual({ lat: 39.4699, lng: -0.3763 });
  });

  it("falls back to the province name when the city is unknown", () => {
    const coords = resolveCochesNetCoords(
      location({ cityLiteral: "Villa Inexistente", mainProvince: "Granada" }),
    );
    expect(coords).toEqual({ lat: 37.1773, lng: -3.5986 });
  });

  it("falls back to the province-id centroid when names don't match", () => {
    const coords = resolveCochesNetCoords(
      location({ cityLiteral: "", mainProvince: "", mainProvinceId: 28 }),
    );
    // INE 28 = Madrid.
    expect(coords).toEqual({ lat: 40.4168, lng: -3.7038 });
  });

  it("falls back to the Spain center when nothing resolves", () => {
    const coords = resolveCochesNetCoords(
      location({ mainProvinceId: 999 }),
    );
    expect(coords).toEqual({ lat: 40.0, lng: -3.5 });
  });
});
