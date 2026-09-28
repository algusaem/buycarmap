import { describe, expect, it } from "vitest";
import { ALL_CARS_SLUG, mapBrandToSlug, mapFuelTokens, mapTransmissionToken } from "./taxonomy";

describe("mapBrandToSlug", () => {
  it("derives the slug for a regular brand name", () => {
    expect(mapBrandToSlug("Audi")).toBe("audi-de-segunda-mano");
  });

  it("strips accents when deriving the slug", () => {
    expect(mapBrandToSlug("Citroën")).toBe("citroen-de-segunda-mano");
  });

  it("slugifies hyphenated and multi-word brands", () => {
    expect(mapBrandToSlug("Mercedes-Benz")).toBe("mercedes-benz-de-segunda-mano");
    expect(mapBrandToSlug("Land Rover")).toBe("land-rover-de-segunda-mano");
  });

  it("returns the all-cars slug when no brand is given", () => {
    expect(mapBrandToSlug(undefined)).toBe(ALL_CARS_SLUG);
  });
});

describe("mapFuelTokens", () => {
  it("maps Wallapop fuel tokens to Milanuncios tokens", () => {
    expect(mapFuelTokens(["gasoline", "gasoil"])).toEqual(["gasolina", "diesel"]);
  });

  it("collapses both hybrid tokens into a single 'hibrido'", () => {
    // Milanuncios has no plug-in-hybrid token, so the two map to one and dedupe.
    expect(mapFuelTokens(["hybride", "hybride_plugin"])).toEqual(["hibrido"]);
  });

  it("SRC-6: drops tokens with no Milanuncios equivalent", () => {
    expect(mapFuelTokens(["mystery-fuel"])).toEqual([]);
  });
});

describe("mapTransmissionToken", () => {
  it("maps manual and automatic", () => {
    expect(mapTransmissionToken(["manual"])).toBe("manual");
    expect(mapTransmissionToken(["automatic"])).toBe("automatico");
  });

  it("treats semi-automatic as automatic", () => {
    expect(mapTransmissionToken(["semiautomatic"])).toBe("automatico");
  });

  it("returns undefined when nothing maps", () => {
    expect(mapTransmissionToken(["cvt"])).toBeUndefined();
  });
});
