import type { CarListing } from "@/interfaces/listing";
import type { WallapopSearchResponse } from "@/interfaces/wallapop";
import type { CochesNetSearchResponse } from "@/interfaces/cochesnet";
import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import type { SearchInput } from "@/server/search/schema";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { normalizeMilanunciosItems } from "@/lib/milanuncios/normalize";
import { filterByRadius } from "@/lib/geo/radius";

// Merge the per-source result lists by round-robin, so every source appears
// near the top instead of one dominating.
function interleave(lists: CarListing[][]): CarListing[] {
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
// where the three result lists meet (MAP-16, MAP-17, MAP-18).
function applyResultFilters(listings: CarListing[], params: SearchInput): CarListing[] {
  return filterByModel(filterByRadius(listings, params), params.model);
}

export interface PageState {
  wallapopNext: string | null;
  cochesNetPage: number;
  cochesNetHasMore: boolean;
  milanunciosPage: number;
  milanunciosHasMore: boolean;
}

export const EMPTY_PAGE: PageState = {
  wallapopNext: null,
  cochesNetPage: 0,
  cochesNetHasMore: false,
  milanunciosPage: 0,
  milanunciosHasMore: false,
};

export function hasMorePages(state: PageState): boolean {
  return state.wallapopNext !== null || state.cochesNetHasMore || state.milanunciosHasMore;
}

interface SourcePageState {
  page: number;
  hasMore: boolean;
}

interface RoundCollection {
  listings: CarListing[];
  cnData: CochesNetSearchResponse | null;
  mnData: MilanunciosSearchResponse | null;
}

// Normalizes the three Promise.allSettled results into one merged, filtered
// listing set, and hands back each structured source's raw response so the
// per-source page-state helpers below don't have to re-derive it.
export function collectRoundResults(
  wpResult: PromiseSettledResult<WallapopSearchResponse | null>,
  cnResult: PromiseSettledResult<CochesNetSearchResponse | null>,
  mnResult: PromiseSettledResult<MilanunciosSearchResponse | null>,
  params: SearchInput,
): RoundCollection {
  const wpItems =
    wpResult.status === "fulfilled" && wpResult.value
      ? normalizeWallapopItems(wpResult.value.data?.section?.items ?? [])
      : [];
  const cnData = cnResult.status === "fulfilled" ? cnResult.value : null;
  const cnItems = cnData ? normalizeCochesNetItems(cnData.items ?? []) : [];
  const mnData = mnResult.status === "fulfilled" ? mnResult.value : null;
  const mnItems = mnData ? normalizeMilanunciosItems(mnData.ads ?? []) : [];

  return {
    listings: applyResultFilters(interleave([wpItems, cnItems, mnItems]), params),
    cnData,
    mnData,
  };
}

// Wallapop's next-page cursor. `search` always requests page 1 (wasRequested
// is always true there); `fetchNextRound` only requests a page when one is
// pending, and otherwise keeps the cursor from the previous round.
function nextWallapopPage(
  wasRequested: boolean,
  wpResult: PromiseSettledResult<WallapopSearchResponse | null>,
  previousNext: string | null,
): string | null {
  if (!wasRequested) return previousNext;
  return wpResult.status === "fulfilled" && wpResult.value
    ? (wpResult.value.meta?.next_page ?? null)
    : null;
}

function nextPageState(
  wasRequested: boolean,
  itemCount: number | null,
  totalPages: number | undefined,
  previousPage: number,
  previousHasMore: boolean,
): SourcePageState {
  if (!wasRequested) return { page: previousPage, hasMore: previousHasMore };
  const page = previousPage + 1;
  const hasMore = itemCount !== null && itemCount > 0 && page < (totalPages ?? 1);
  return { page, hasMore };
}

interface RoundRequested {
  wallapop: boolean;
  cochesNet: boolean;
  milanuncios: boolean;
}

// The page state after one round, given which sources a page was requested
// from. `search` advances from EMPTY_PAGE having requested all three;
// `fetchNextRound` advances from the previous round's state having requested
// only the sources that still had a page pending.
export function advancePageState(
  prev: PageState,
  requested: RoundRequested,
  wpResult: PromiseSettledResult<WallapopSearchResponse | null>,
  cnData: CochesNetSearchResponse | null,
  mnData: MilanunciosSearchResponse | null,
): PageState {
  const cnNext = nextPageState(
    requested.cochesNet,
    cnData ? cnData.items.length : null,
    cnData?.meta?.totalPages,
    prev.cochesNetPage,
    prev.cochesNetHasMore,
  );
  const mnNext = nextPageState(
    requested.milanuncios,
    mnData ? mnData.ads.length : null,
    mnData?.pagination?.totalPages,
    prev.milanunciosPage,
    prev.milanunciosHasMore,
  );
  return {
    wallapopNext: nextWallapopPage(requested.wallapop, wpResult, prev.wallapopNext),
    cochesNetPage: cnNext.page,
    cochesNetHasMore: cnNext.hasMore,
    milanunciosPage: mnNext.page,
    milanunciosHasMore: mnNext.hasMore,
  };
}
