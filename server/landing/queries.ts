import { unstable_cache } from "next/cache";
import type { CarListing } from "@/interfaces/listing";
import { logger } from "@/lib/logger";
import { EMPTY_SEARCH_CURSORS } from "@/server/search/schema";
import { searchRound } from "@/server/search/service";
import { pickPreviewListings } from "./service";

// docs/specs/redesign-entry.md (ENTRY-35, ENTRY-36): the listings the landing's
// map preview draws from. One nationwide search, kept for an hour, so a visit
// never reaches the marketplaces itself.

const POOL_TTL_SECONDS = 3600;

// Throws rather than returning nothing: a thrown search is not cached, so the
// next visit tries again instead of an hour of the example car.
const cachedPool = unstable_cache(
  async () => {
    const { listings } = await searchRound({}, EMPTY_SEARCH_CURSORS);
    const pool = listings.filter((listing) => listing.image !== "" && listing.price > 0);
    if (pool.length === 0) throw new Error("No listing to show on the landing");
    return pool;
  },
  ["landing-pool"],
  { revalidate: POOL_TTL_SECONDS },
);

/** The landing preview's listings, empty when the search failed (ENTRY-36). */
export async function getLandingPool(): Promise<CarListing[]> {
  try {
    return await cachedPool();
  } catch (error) {
    logger.warn({ err: error }, "The landing preview falls back to its example car");
    return [];
  }
}

/** The listings the preview shows on this visit, the card's first (ENTRY-34). */
export async function getPreviewListings(): Promise<CarListing[]> {
  return pickPreviewListings(await getLandingPool());
}
