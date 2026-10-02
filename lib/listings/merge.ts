import type { CarListing } from "@/interfaces/listing";
import type { SearchInput } from "@/lib/search/schema";
import { filterByRadius } from "@/lib/geo/radius";

// Merge the per-source result lists by round-robin, so every source appears
// near the top instead of one dominating. Shared by server/search/service.ts,
// which is the only place that still fans a search out per source (FRONT-1).
export function interleave(lists: CarListing[][]): CarListing[] {
  const merged: CarListing[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) merged.push(list[i]);
    }
  }
  return merged;
}

// MAP-18: Milanuncios matches the model as free text upstream and coches.net
// can fall back to make-only filtering, so a model search gets diluted with
// related-but-wrong cars. Substring on the model field or title, erring
// permissive — dropping a genuinely matching car is worse than keeping a
// mislabelled one. Titles matter because Milanuncios carries no structured
// model at all; descriptions would false-match ("acepto cambio por…").
function filterByModel(listings: CarListing[], model: string | undefined): CarListing[] {
  const wanted = model?.trim().toLowerCase();
  if (!wanted) return listings;
  return listings.filter(
    (listing) =>
      listing.model.toLowerCase().includes(wanted) || listing.title.toLowerCase().includes(wanted),
  );
}

// Every filter the sources cannot be trusted to enforce upstream, applied
// where the three result lists meet (MAP-16, MAP-17, MAP-18). Applied by
// server/search/actions.ts's searchListings, after server/search/service.ts's
// searchRound returns the round's merged-but-unfiltered listings.
export function applyResultFilters(listings: CarListing[], params: SearchInput): CarListing[] {
  return filterByModel(filterByRadius(listings, params), params.model);
}

// Whether a further round should be requested, now that each source's
// pagination state lives in server/search/service.ts's `SearchRound.hasMore`
// rather than this module's old `PageState`. Used by
// lib/hooks/useListingsSearch.ts's "fetch until a round yields a listing or
// the sources run out" loop (MAP-19).
export function hasAnyMore(hasMore: Record<string, boolean>): boolean {
  return Object.values(hasMore).some(Boolean);
}
