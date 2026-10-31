import { describe, expect, it } from "vitest";
import type { CarListing } from "@/interfaces/listing";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
import { pickPreviewListings } from "./service";

// docs/specs/redesign-entry.md (ENTRY-34), worked example "The preview's
// listing": a pool of three listings at 9.400 €, 14.500 € and 16.500 €. The
// pick lands on index Math.floor(random() * pool.length); that listing goes
// first, the rest keep their original order.

function pool(): CarListing[] {
  return [
    makeFavoriteInput({ id: "listing-14500", price: 14500 }),
    makeFavoriteInput({ id: "listing-9400", price: 9400 }),
    makeFavoriteInput({ id: "listing-16500", price: 16500 }),
  ];
}

function prices(listings: CarListing[]): number[] {
  return listings.map((listing) => listing.price);
}

describe("ENTRY-34: pickPreviewListings", () => {
  it("ENTRY-34: random () => 0.4 picks index 1 (9.400 €) first, the others in order", () => {
    // Math.floor(0.4 * 3) = 1.
    const result = pickPreviewListings(pool(), () => 0.4);
    expect(prices(result)).toEqual([9400, 14500, 16500]);
  });

  it("ENTRY-34: random () => 0 picks index 0 (14.500 €) first, the others in order", () => {
    // Math.floor(0 * 3) = 0.
    const result = pickPreviewListings(pool(), () => 0);
    expect(prices(result)).toEqual([14500, 9400, 16500]);
  });

  it("ENTRY-34: random () => 0.99 picks index 2 (16.500 €) first, the others in order", () => {
    // Math.floor(0.99 * 3) = 2.
    const result = pickPreviewListings(pool(), () => 0.99);
    expect(prices(result)).toEqual([16500, 14500, 9400]);
  });

  it("ENTRY-34: an empty pool returns an empty list", () => {
    expect(pickPreviewListings([])).toEqual([]);
  });
});
