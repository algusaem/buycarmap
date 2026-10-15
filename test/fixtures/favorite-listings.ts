import type { CarListing } from "@/interfaces/listing";
import type { SavedSort } from "@/lib/favorites/sort";

// The saved cars the tests render and seed: one listing as saveFavorite
// receives it, and docs/specs/redesign-saved.md's worked example "Sort". Plain
// data with no test runner in it, so e2e/saved.spec.ts seeds the same cars
// the component tests render.

export function makeFavoriteInput(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-abc123",
    image: "https://cdn.wallapop.com/img1-big.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "Great condition",
    price: 14500,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-abc123",
    ...overrides,
  };
}

/** The snapshot columns saveFavorite would have written, for rows seeded directly. */
export function toSnapshot(): Omit<CarListing, "id"> {
  const { id: _id, ...snapshot } = makeFavoriteInput();
  return snapshot;
}

/** A car of docs/specs/redesign-saved.md's worked example "Sort", by its letter. */
export type SortExampleLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

// docs/specs/redesign-saved.md › Worked examples › Sort: Ada's seven saved
// cars. A price or km of 0 is unknown. Each sits in its own city, so each has
// its own pin unless a test moves it. Only the fields the table names (and
// the city and coordinates a pin needs) differ from makeFavoriteInput's.
const SORT_EXAMPLE: Record<SortExampleLetter, Partial<CarListing>> = {
  A: {
    title: "Audi A3 2.0 TDI",
    price: 14500,
    mileage: 95000,
    location: "Madrid",
    lat: 40.4168,
    lng: -3.7038,
  },
  B: {
    title: "SEAT León 1.5 TSI",
    price: 16500,
    mileage: 64000,
    location: "Barcelona",
    lat: 41.3874,
    lng: 2.1686,
  },
  C: {
    title: "Renault Clio TCe 90",
    price: 0,
    mileage: 71000,
    location: "Valencia",
    lat: 39.4699,
    lng: -0.3763,
  },
  D: {
    title: "VW Golf 1.6 TDI",
    price: 11900,
    mileage: 0,
    location: "Sevilla",
    lat: 37.3891,
    lng: -5.9845,
  },
  E: {
    title: "Kia Ceed 1.6 CRDi",
    price: 14500,
    mileage: 81000,
    location: "Bilbao",
    lat: 43.263,
    lng: -2.935,
  },
  F: {
    title: "Mazda MX-5 2.0",
    price: 21500,
    mileage: 64000,
    location: "Zaragoza",
    lat: 41.6488,
    lng: -0.8891,
  },
  G: {
    title: "Toyota Corolla 125H",
    price: 0,
    mileage: 48000,
    location: "Málaga",
    lat: 36.7213,
    lng: -4.4214,
  },
};

/** One car of the "Sort" example, with `overrides` on top. */
export function makeSortExampleCar(
  letter: SortExampleLetter,
  overrides: Partial<CarListing> = {},
): CarListing {
  const id = `wallapop-${letter.toLowerCase()}`;
  return makeFavoriteInput({
    id,
    url: `https://es.wallapop.com/item/${id}`,
    ...SORT_EXAMPLE[letter],
    ...overrides,
  });
}

/**
 * The seven cars as the page query returns them: newest saved first. Saved
 * C 10-05, E 10-04, B 10-03, D 10-02, A 10-01, G 09-30, F 09-28, so this
 * order is the example's «Recientes» row, C, E, B, D, A, G, F.
 */
export function sortExampleFavorites(): CarListing[] {
  return SORT_EXAMPLE_ORDER.recent.map((letter) => makeSortExampleCar(letter));
}

/** The "Sort" example's letters, A to G. */
export const SORT_EXAMPLE_LETTERS: readonly SortExampleLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
];

/** Each car's name, by its letter. */
export const SORT_EXAMPLE_TITLE = Object.fromEntries(
  SORT_EXAMPLE_LETTERS.map((letter) => [letter, makeSortExampleCar(letter).title]),
) as Record<SortExampleLetter, string>;

/** The worked example's orders (redesign-saved.md › Worked examples › Sort). */
export const SORT_EXAMPLE_ORDER: Record<SavedSort, SortExampleLetter[]> = {
  recent: ["C", "E", "B", "D", "A", "G", "F"],
  price: ["D", "E", "A", "B", "F", "C", "G"],
  km: ["G", "B", "F", "C", "E", "A", "D"],
};
