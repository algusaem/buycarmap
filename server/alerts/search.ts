import type { CarListing } from "@/interfaces/listing";
import type { SearchInput } from "@/lib/search/schema";
import { applyResultFilters } from "@/lib/listings/merge";
import { EMPTY_SEARCH_CURSORS, searchRound } from "@/server/search/service";

// FRONT-6 (docs/specs/core-frontend.md): the alert runner's path to the three
// upstreams now goes through server/search/service.ts's searchRound, so there
// is one server-side fan-out shared with the interactive search instead of a
// second one kept here. Only the alert-specific overrides survive in this
// file: forcing Wallapop's newest-first ordering and defaulting the time
// window to "today" when the criteria name none (see
// docs/specs/alerts.md › Decisions and rationale) — relevance is the right
// ranking for a human reading a list, but a poller that only ever reads page
// one needs the newest listings at the top or it never sees them.

const SOURCE_NAMES = ["Wallapop", "Coches.net", "Milanuncios"] as const;

export interface AlertSearchResult {
  listings: CarListing[];
  /**
   * Sources whose request failed. Nothing from these is recorded as seen — if
   * a failed source were treated as polled, listings that appeared during the
   * outage would never be new again (ALERT-17).
   */
  failedSources: string[];
  /**
   * Per-source counts, before merging. After merging, "Milanuncios returned
   * nothing" and "Milanuncios is quietly broken" are indistinguishable, and a
   * Milanuncios parse failure returns zero ads rather than an error (ALERT-20).
   */
  perSourceCounts: Record<string, number>;
}

/**
 * Polls all three sources for one criteria set, through the shared fan-out.
 *
 * Partial failure is the normal case, not an outage — three reverse-engineered
 * upstreams means one being unavailable is a Tuesday. Unlike the interactive
 * search, which merely renders fewer results, the alert path has to know
 * *which* source failed so the seen-list is only advanced for the ones that
 * answered.
 */
export async function searchAllSources(criteria: SearchInput): Promise<AlertSearchResult> {
  // Narrows the page to today's listings, which is as close to "recent" as
  // any of the three gets. Wallapop is the only source that honours it.
  const input: SearchInput = { ...criteria, timeFilter: criteria.timeFilter ?? "today" };

  const round = await searchRound(input, EMPTY_SEARCH_CURSORS, {
    wallapopOrderBy: "newest",
    cochesNetSortTerm: "publishedDate",
  });

  // Every source failing is the one case the caller must treat as "no
  // information", not "nothing new" — otherwise a total outage silently
  // advances nothing while looking like a successful empty poll.
  if (round.failedSources.length === SOURCE_NAMES.length) {
    throw new Error(`every source failed: ${round.failedSources.join(", ")}`);
  }

  const perSourceCounts: Record<string, number> = {};
  for (const source of SOURCE_NAMES) {
    if (round.failedSources.includes(source)) continue;
    perSourceCounts[source] = round.listings.filter((listing) => listing.source === source).length;
  }

  // ALERT-43/ALERT-44 (docs/specs/alerts.md › Matches respect the radius and
  // the model, as the map does): the same post-filter the map search applies
  // at its merge (MAP-16, MAP-17, MAP-18), so an alert never promises less
  // than the search it was saved from. Applied after perSourceCounts above,
  // which must stay pre-filter — a narrow radius filtering a nationwide page
  // to nothing is not the source going silent.
  const listings = applyResultFilters(round.listings, input);

  return {
    listings,
    failedSources: round.failedSources,
    perSourceCounts,
  };
}
