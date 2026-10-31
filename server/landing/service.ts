import type { CarListing } from "@/interfaces/listing";

/**
 * The visit's order of the landing pool (docs/specs/redesign-entry.md,
 * ENTRY-34): a random listing first, for the card and the active pin, then the
 * others as they came, for the other pins.
 */
export function pickPreviewListings(
  pool: CarListing[],
  random: () => number = Math.random,
): CarListing[] {
  const picked = Math.floor(random() * pool.length);
  const featured = pool[picked];
  if (!featured) return [];
  return [featured, ...pool.filter((_, index) => index !== picked)];
}
