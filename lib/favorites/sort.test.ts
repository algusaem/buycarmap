import { describe, expect, it } from "vitest";
import { createLoader, createSerializer } from "nuqs/server";
import type { CarListing } from "@/interfaces/listing";
import {
  makeSortExampleCar,
  type SortExampleLetter,
  sortExampleFavorites,
} from "@/test/fixtures/favorite-listings";
import { savedSortParsers, sortSaved } from "./sort";

// docs/specs/redesign-saved.md › Worked examples › Sort. The input is the
// page query's order, newest saved first: C, E, B, D, A, G, F. Every expected
// order below is the table's own row, derived by hand there:
// - Precio: D 11.900 €; A and E tie at 14.500 €, E saved later goes first;
//   B 16.500 €, F 21.500 €; C and G unknown (0), last, C saved later first.
// - Km: G 48.000; B and F tie at 64.000, B saved later first; C 71.000,
//   E 81.000, A 95.000; D unknown (0), last.

const LETTER_BY_ID = new Map(
  (["A", "B", "C", "D", "E", "F", "G"] as const).map((letter) => [
    makeSortExampleCar(letter).id,
    letter,
  ]),
);

function letters(listings: CarListing[]): (SortExampleLetter | undefined)[] {
  return listings.map((listing) => LETTER_BY_ID.get(listing.id));
}

describe("SAVED-5: sortSaved — the worked example", () => {
  it("SAVED-5: «Recientes» keeps newest saved first — C, E, B, D, A, G, F", () => {
    expect(letters(sortSaved(sortExampleFavorites(), "recent"))).toEqual([
      "C",
      "E",
      "B",
      "D",
      "A",
      "G",
      "F",
    ]);
  });

  it("SAVED-5: «Precio» is cheapest first, ties newest first, unknown prices last — D, E, A, B, F, C, G", () => {
    expect(letters(sortSaved(sortExampleFavorites(), "price"))).toEqual([
      "D",
      "E",
      "A",
      "B",
      "F",
      "C",
      "G",
    ]);
  });

  it("SAVED-5: «Km» is fewest kilometres first, ties newest first, unknown km last — G, B, F, C, E, A, D", () => {
    expect(letters(sortSaved(sortExampleFavorites(), "km"))).toEqual([
      "G",
      "B",
      "F",
      "C",
      "E",
      "A",
      "D",
    ]);
  });
});

describe("SAVED-5: sortSaved — edge cases", () => {
  it("SAVED-5: an empty list sorts to an empty list under every sort", () => {
    expect(sortSaved([], "recent")).toEqual([]);
    expect(sortSaved([], "price")).toEqual([]);
    expect(sortSaved([], "km")).toEqual([]);
  });

  it("SAVED-5: is pure — the input array keeps its order", () => {
    const input = sortExampleFavorites();
    const before = input.map((listing) => listing.id);

    const sorted = sortSaved(input, "price");

    expect(input.map((listing) => listing.id)).toEqual(before);
    expect(sorted).not.toBe(input);
    expect(sorted).toHaveLength(7);
  });

  it("SAVED-5: when every price is unknown, «Precio» is the newest-first order", () => {
    // C and G are both 0; with A's price made unknown too, the three keep
    // the input's order among themselves: C (10-05), A (10-01), G (09-30).
    const input = [
      makeSortExampleCar("C"),
      makeSortExampleCar("A", { price: 0 }),
      makeSortExampleCar("G"),
    ];

    expect(letters(sortSaved(input, "price"))).toEqual(["C", "A", "G"]);
  });
});

describe("SAVED-7: the sort in the URL", () => {
  const serialize = createSerializer(savedSortParsers);
  const load = createLoader(savedSortParsers);

  it("SAVED-7: «Precio» is sort=price and «Km» is sort=km", () => {
    expect(serialize("/favorites", { sort: "price" })).toBe("/favorites?sort=price");
    expect(serialize("/favorites", { sort: "km" })).toBe("/favorites?sort=km");
  });

  it("SAVED-7: «Recientes» is the default and writes no sort parameter", () => {
    expect(serialize("/favorites", { sort: "recent" })).toBe("/favorites");
  });

  it("SAVED-7: sort=price and sort=km read back as «Precio» and «Km»", () => {
    expect(load(new URLSearchParams("sort=price"))).toEqual({ sort: "price" });
    expect(load(new URLSearchParams("sort=km"))).toEqual({ sort: "km" });
  });

  it.each([
    ["missing", ""],
    ["empty", "sort="],
    ["unknown", "sort=year"],
  ])("SAVED-7: a sort that is %s reads as «Recientes», with no error", (_case, query) => {
    expect(load(new URLSearchParams(query))).toEqual({ sort: "recent" });
  });
});
