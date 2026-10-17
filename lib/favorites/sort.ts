import { parseAsStringLiteral } from "nuqs/server";
import type { CarListing } from "@/interfaces/listing";

// docs/specs/redesign-saved.md (SAVED-5, SAVED-7): the saved cars' order, a
// pure function of the cars (newest saved first, as the page query returns
// them) and the sort in force, and the sort's place in the URL.

/** «Recientes», «Precio» and «Km». */
export const SAVED_SORTS = ["recent", "price", "km"] as const;

export type SavedSort = (typeof SAVED_SORTS)[number];

/**
 * `sort=price` and `sort=km`; «Recientes» is the default, which nuqs leaves out
 * of the URL, and any other value reads as it (SAVED-7).
 */
export const savedSortParsers = {
  sort: parseAsStringLiteral(SAVED_SORTS).withDefault("recent"),
};

/** The field a sort orders by; «Recientes» keeps the page query's order. */
const SORT_FIELD: Record<Exclude<SavedSort, "recent">, "price" | "mileage"> = {
  price: "price",
  km: "mileage",
};

/**
 * The saved cars in the sort's order. A price or km of 0 is unknown and goes
 * after every known one. `Array.prototype.sort` is stable, so cars that tie,
 * the unknown ones included, keep the input's newest-first order (SAVED-5).
 */
export function sortSaved(listings: readonly CarListing[], sort: SavedSort): CarListing[] {
  if (sort === "recent") return [...listings];
  const field = SORT_FIELD[sort];

  return [...listings].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    if (left === 0) return 1;
    if (right === 0) return -1;
    return left - right;
  });
}
