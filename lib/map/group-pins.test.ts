import { describe, expect, it } from "vitest";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
import { ES_COPY } from "@/test/utils/copy";
import { groupPins } from "./group-pins";

// docs/specs/redesign-map.md (MAPUI-25, MAPUI-26, worked example under
// "Grouping"). Four listings, two pins: three cars sharing one point
// (coordinates equal to five decimals) and one car on its own.
//
// makeFavoriteInput (test/fixtures/favorite-listings.ts) builds a full CarListing;
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

// docs/specs/redesign-map.md › Worked examples › "Grouping with an unknown
// price" (MAPUI-26, amended 2026-10-15 by SAVED-12, redesign-saved.md): a
// price of 0 is unknown, ignored for «desde» and listed after every known
// price. All four sit at (40.41680, -3.70380).
const E = makeFavoriteInput({ id: "E", price: 0, lat: 40.4168, lng: -3.7038 });
const F = makeFavoriteInput({ id: "F", price: 12000, lat: 40.4168, lng: -3.7038 });
const G = makeFavoriteInput({ id: "G", price: 9500, lat: 40.4168, lng: -3.7038 });
const H = makeFavoriteInput({ id: "H", price: 0, lat: 40.4168, lng: -3.7038 });

describe("MAPUI-26: groupPins — an unknown price (amended by SAVED-12)", () => {
  it("MAPUI-26: E, F and G share one pin «3 coches · desde 9.500 €», not «desde 0 €»", () => {
    const [group] = groupPins([E, F, G], ES_COPY);

    expect(group.label).toBe("3 coches · desde 9.500\u00a0€");
  });

  it("MAPUI-26: the unknown price goes after every known one — G, F, E", () => {
    const [group] = groupPins([E, F, G], ES_COPY);

    expect(group.listings.map((listing) => listing.id)).toEqual(["G", "F", "E"]);
  });

  it("MAPUI-26: a group whose prices are all unknown reads «2 coches · desde 0 €»", () => {
    const [group] = groupPins([E, H], ES_COPY);

    expect(group.label).toBe("2 coches · desde 0\u00a0€");
  });

  it("MAPUI-26: E alone keeps its single pin «0 €»", () => {
    const [group] = groupPins([E], ES_COPY);

    expect(group.label).toBe("0\u00a0€");
  });
});

// docs/specs/redesign-saved.md › Worked examples › "Grouped pin with an
// unknown price": cars from the "Sort" example moved to one point.
describe("SAVED-12: groupPins — the saved cars' grouped pins", () => {
  const POINT = { lat: 40.4168, lng: -3.7038 };
  const audi = makeFavoriteInput({ id: "A", title: "Audi A3", price: 14500, ...POINT });
  const clio = makeFavoriteInput({ id: "C", title: "Renault Clio", price: 0, ...POINT });
  const corolla = makeFavoriteInput({ id: "G", title: "Toyota Corolla", price: 0, ...POINT });
  const golf = makeFavoriteInput({ id: "D", title: "VW Golf", price: 11900, ...POINT });
  const ceed = makeFavoriteInput({ id: "E", title: "Kia Ceed", price: 14500, ...POINT });

  it("SAVED-12: A (14.500 €) and C (unknown) read «2 coches · desde 14.500 €», preview A then C", () => {
    const [group] = groupPins([clio, audi], ES_COPY);

    expect(group.label).toBe("2 coches · desde 14.500\u00a0€");
    expect(group.listings.map((listing) => listing.id)).toEqual(["A", "C"]);
  });

  it("SAVED-12: C and G, both unknown, read «2 coches · desde 0 €»", () => {
    const [group] = groupPins([clio, corolla], ES_COPY);

    expect(group.label).toBe("2 coches · desde 0\u00a0€");
  });

  it("SAVED-12: D (11.900 €), C (unknown) and E (14.500 €) read «3 coches · desde 11.900 €», preview D, E, C", () => {
    const [group] = groupPins([clio, ceed, golf], ES_COPY);

    expect(group.label).toBe("3 coches · desde 11.900\u00a0€");
    expect(group.listings.map((listing) => listing.id)).toEqual(["D", "E", "C"]);
  });
});
