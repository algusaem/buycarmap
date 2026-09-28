import { describe, expect, it } from "vitest";
import { mapBrandToMakeId, mapFuelTokensToIds, mapTransmissionTokensToId } from "./taxonomy";

describe("mapBrandToMakeId", () => {
  it("resolves a known brand to its coches.net makeId", () => {
    expect(mapBrandToMakeId("Audi")).toBe(4);
    expect(mapBrandToMakeId("Mercedes-Benz")).toBe(28);
  });

  it("returns undefined for an unknown brand", () => {
    expect(mapBrandToMakeId("DeLorean")).toBeUndefined();
  });
});

describe("mapFuelTokensToIds", () => {
  it("maps known fuel tokens and drops unknown ones", () => {
    expect(mapFuelTokensToIds(["gasoline", "gasoil", "unknown"])).toEqual([2, 1]);
  });

  it("returns an empty array when no token is recognised", () => {
    expect(mapFuelTokensToIds(["nope"])).toEqual([]);
  });
});

describe("mapTransmissionTokensToId", () => {
  it("returns the id of the first recognised token", () => {
    expect(mapTransmissionTokensToId(["manual"])).toBe(2);
    expect(mapTransmissionTokensToId(["automatic"])).toBe(1);
  });

  it("collapses semiautomatic onto automatic (coches.net has no separate id)", () => {
    expect(mapTransmissionTokensToId(["semiautomatic"])).toBe(1);
  });

  it("SRC-6: returns undefined when no token is recognised", () => {
    expect(mapTransmissionTokensToId(["cvt"])).toBeUndefined();
  });
});
