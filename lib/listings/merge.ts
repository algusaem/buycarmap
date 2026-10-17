import type { CarListing } from "@/interfaces/listing";
import type { SearchInput } from "@/lib/search/schema";
import { filterByRadius } from "@/lib/geo/radius";
import { fold } from "@/lib/search/fold";
import { classifyFuel, groupsFromEngine, isGroupedEngineValue } from "@/lib/search/fuel-groups";

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
// model at all; descriptions would false-match ("acepto cambio por…"). Both
// sides are folded (case and accents ignored, owner decision 2026-10-14) so
// "SEAT León", "SEAT Leon" and "seaT LeON" all match the same model.
function filterByModel(listings: CarListing[], model: string | undefined): CarListing[] {
  const wanted = fold(model?.trim() ?? "");
  if (!wanted) return listings;
  return listings.filter(
    (listing) => fold(listing.model).includes(wanted) || fold(listing.title).includes(wanted),
  );
}

// MAPUI-55 (docs/specs/redesign-map.md): a fuel criterion keeps only the
// listings whose fuel is recognised and belongs to a chosen group. A listing
// with no fuel, or one no group recognises, cannot be confirmed as the fuel
// asked for, so it is dropped. A criterion holding any value no group offers
// (`cng`, MAPUI-18), alone or beside others (`gasoil,cng`), applies no fuel
// post-filter at all and leaves the listings to the sources' own filter
// (owner decision, 2026-10-13).
function filterByFuel(listings: CarListing[], engine: string[] | undefined): CarListing[] {
  const values = engine ?? [];
  if (values.some((value) => !isGroupedEngineValue(value))) return listings;
  const groups = groupsFromEngine(values);
  if (groups.length === 0) return listings;
  return listings.filter((listing) => {
    const group = classifyFuel(listing.fuel);
    return group !== undefined && groups.includes(group);
  });
}

// Every filter the sources cannot be trusted to enforce upstream, applied
// where the three result lists meet (MAP-16, MAP-17, MAP-18, MAPUI-55). Like
// the radius and the model, the fuel can empty a page, and MAP-19's fetching
// keeps going. Applied by server/search/actions.ts's searchListings, after
// server/search/service.ts's searchRound returns the round's
// merged-but-unfiltered listings.
export function applyResultFilters(listings: CarListing[], params: SearchInput): CarListing[] {
  return filterByFuel(filterByModel(filterByRadius(listings, params), params.model), params.engine);
}

// Whether a further round should be requested, now that each source's
// pagination state lives in server/search/service.ts's `SearchRound.hasMore`
// rather than this module's old `PageState`. Used by
// lib/hooks/useListingsSearch.ts's "fetch until a round yields a listing or
// the sources run out" loop (MAP-19).
export function hasAnyMore(hasMore: Record<string, boolean>): boolean {
  return Object.values(hasMore).some(Boolean);
}
