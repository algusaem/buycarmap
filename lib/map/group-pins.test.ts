import { describe, expect, it } from "vitest";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { ES_COPY } from "@/test/utils/copy";
import { groupPins } from "./group-pins";

// docs/specs/redesign-map.md (MAPUI-25, MAPUI-26, worked example under
// "Grouping"). Four listings, two pins: three cars sharing one point
// (coordinates equal to five decimals) and one car on its own.
//
// makeFavoriteInput (test/fixtures/favorites.ts) builds a full CarListing;
// only id, price and coordinates are overridden per MAPUI-26's worked
// example, since the grouping logic reads only those fields.

const A = makeFavoriteInput({ id: "A", price: 14500, lat: 40.4168, lng: -3.7038 });
const B = makeFavoriteInput({ id: "B", price: 9500, lat: 40.4168, lng: -3.7038 });
// Equal to A and B to five decimals (40.416804 -> 40.41680), not exactly.
const C = makeFavoriteInput({ id: "C", price: 12000, lat: 40.416804, lng: -3.703801 });
const D = makeFavoriteInput({ id: "D", price: 18900, lat: 41.3879, lng: 2.1699 });

describe("MAPUI-26: groupPins — the worked example", () => {
  it("MAPUI-26: groups A, B and C into one pin and leaves D on its own", () => {
    const groups = groupPins([A, B, C, D], ES_COPY);

    expect(groups).toHaveLength(2);
  });

  it("MAPUI-26: the shared pin's label is '3 coches · desde 9.500 €', the lowest of the three prices", () => {
    const groups = groupPins([A, B, C, D], ES_COPY);
    const shared = groups.find((group) => group.listings.length === 3);

    expect(shared?.label).toBe("3 coches · desde 9.500\u00a0€");
  });

  it("MAPUI-26: the shared pin lists its cars by price ascending — B, C, A", () => {
    const groups = groupPins([A, B, C, D], ES_COPY);
    const shared = groups.find((group) => group.listings.length === 3);

    expect(shared?.listings.map((listing) => listing.id)).toEqual(["B", "C", "A"]);
  });

  it("MAPUI-26: D's pin label is just its price, with no 'coches' wording", () => {
    const groups = groupPins([A, B, C, D], ES_COPY);
    const solo = groups.find((group) => group.listings.length === 1);

    expect(solo?.label).toBe("18.900\u00a0€");
    expect(solo?.listings.map((listing) => listing.id)).toEqual(["D"]);
  });
});

describe("MAPUI-26: groupPins — edge cases", () => {
  it("MAPUI-26: an empty list gives no pins", () => {
    expect(groupPins([], ES_COPY)).toEqual([]);
  });

  it("MAPUI-26: two listings at genuinely different points give two separate pins", () => {
    const groups = groupPins([A, D], ES_COPY);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.listings.length === 1)).toBe(true);
  });
});
