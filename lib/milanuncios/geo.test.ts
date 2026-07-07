import { describe, expect, it } from "vitest";
import { resolveMilanunciosCoords } from "./geo";
import { MilanunciosLocation, MilanunciosPlace } from "@/interfaces/milanuncios";

function place(name: string, id = 0): MilanunciosPlace {
  return { id, name, slug: name.toLowerCase() };
}

describe("resolveMilanunciosCoords", () => {
  it("resolves an exact city match first", () => {
    const loc: MilanunciosLocation = { city: place("Valencia") };
    expect(resolveMilanunciosCoords(loc, undefined)).toEqual({
      lat: 39.4699,
      lng: -0.3763,
    });
  });

  it("falls back to the province name when the city is unknown", () => {
    const loc: MilanunciosLocation = {
      city: place("Villa Inexistente"),
      province: place("Granada"),
    };
    expect(resolveMilanunciosCoords(loc, undefined)).toEqual({
      lat: 37.1773,
      lng: -3.5986,
    });
  });

  it("falls back to the province-id centroid when names don't match", () => {
    const loc: MilanunciosLocation = {
      city: place("Nowhere"),
      province: place("Unmapped", 28), // INE 28 = Madrid
    };
    expect(resolveMilanunciosCoords(loc, undefined)).toEqual({
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("uses the top-level province when location has none", () => {
    expect(resolveMilanunciosCoords(undefined, place("Sevilla"))).toEqual({
      lat: 37.3891,
      lng: -5.9845,
    });
  });

  it("falls back to the Spain center when nothing resolves", () => {
    const loc: MilanunciosLocation = { city: place("Nowhere") };
    expect(resolveMilanunciosCoords(loc, undefined)).toEqual({
      lat: 40.0,
      lng: -3.5,
    });
  });
});
