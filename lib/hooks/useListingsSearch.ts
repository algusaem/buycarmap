import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CarListing } from "@/interfaces/listing";
import type { WallapopSearchResponse } from "@/interfaces/wallapop";
import type { CochesNetSearchResponse } from "@/interfaces/cochesnet";
import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import { searchSchema, type SearchInput } from "@/lib/validations/search";
import { searchWallapop } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { searchCochesNet } from "@/lib/cochesnet/client";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { searchMilanuncios } from "@/lib/milanuncios/client";
import { normalizeMilanunciosItems } from "@/lib/milanuncios/normalize";
import { getCached, setCached } from "@/lib/wallapop/cache";
import { filterByRadius } from "@/lib/geo/radius";
import { useTranslation } from "@/lib/i18n/client";

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

interface PageState {
  wallapopNext: string | null;
  cochesNetPage: number;
  cochesNetHasMore: boolean;
  milanunciosPage: number;
  milanunciosHasMore: boolean;
}

const EMPTY_PAGE: PageState = {
  wallapopNext: null,
  cochesNetPage: 0,
  cochesNetHasMore: false,
  milanunciosPage: 0,
  milanunciosHasMore: false,
};

function hasMorePages(state: PageState): boolean {
  return state.wallapopNext !== null || state.cochesNetHasMore || state.milanunciosHasMore;
}

interface RoundResult {
  listings: CarListing[];
  state: PageState;
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
function collectRoundResults(
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
function advancePageState(
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

interface InitialFetchResult {
  wpResult: PromiseSettledResult<WallapopSearchResponse>;
  cnResult: PromiseSettledResult<CochesNetSearchResponse>;
  mnResult: PromiseSettledResult<MilanunciosSearchResponse>;
  allRejected: boolean;
}

// The first page from all three sources, plus whether every one of them
// failed — the one case `search` bails out on entirely.
async function fetchInitialResults(params: SearchInput): Promise<InitialFetchResult> {
  const [wpResult, cnResult, mnResult] = await Promise.allSettled([
    searchWallapop(params),
    searchCochesNet(params, 1),
    searchMilanuncios(params, 1),
  ]);

  const allRejected =
    wpResult.status === "rejected" &&
    cnResult.status === "rejected" &&
    mnResult.status === "rejected";

  return { wpResult, cnResult, mnResult, allRejected };
}

interface CachedSearchContext {
  searchVersionRef: { current: number };
  pageRef: { current: PageState };
  lastParamsRef: { current: SearchInput | null };
  setHasMore: (value: boolean) => void;
  setListings: (value: CarListing[]) => void;
}

// A cache hit only ever holds page 1, so applying it resets pagination to
// this query — else the sentinel would keep paging with the previous
// search's params. Skipped entirely when a newer search has superseded this
// one while `getCached` was resolving.
function applyCachedSearch(
  cached: CarListing[],
  params: SearchInput,
  version: number,
  ctx: CachedSearchContext,
): void {
  if (ctx.searchVersionRef.current !== version) return;
  ctx.pageRef.current = EMPTY_PAGE;
  ctx.lastParamsRef.current = params;
  ctx.setHasMore(false);
  ctx.setListings(cached);
}

// One round of pagination: the next page from every source that still has one,
// normalized, merged and filtered, with the page state advanced past it.
async function fetchNextRound(params: SearchInput, state: PageState): Promise<RoundResult> {
  const wpPromise = state.wallapopNext !== null ? searchWallapop(params, state.wallapopNext) : null;
  const cnPromise = state.cochesNetHasMore
    ? searchCochesNet(params, state.cochesNetPage + 1)
    : null;
  const mnPromise = state.milanunciosHasMore
    ? searchMilanuncios(params, state.milanunciosPage + 1)
    : null;

  const [wpResult, cnResult, mnResult] = await Promise.allSettled([
    wpPromise ?? Promise.resolve(null),
    cnPromise ?? Promise.resolve(null),
    mnPromise ?? Promise.resolve(null),
  ]);

  const { listings, cnData, mnData } = collectRoundResults(wpResult, cnResult, mnResult, params);

  return {
    listings,
    state: advancePageState(
      state,
      {
        wallapop: wpPromise !== null,
        cochesNet: cnPromise !== null,
        milanuncios: mnPromise !== null,
      },
      wpResult,
      cnData,
      mnData,
    ),
  };
}

interface PaginationRunResult {
  aborted: boolean;
  collected: CarListing[];
  state: PageState;
}

// Keeps fetching rounds until one yields a listing or the sources run out
// (MAP-19), bailing out early if a newer search has superseded this one.
async function runPaginationUntilResults(
  params: SearchInput,
  initial: CarListing[],
  initialState: PageState,
  version: number,
  searchVersionRef: { current: number },
): Promise<PaginationRunResult> {
  let state = initialState;
  const collected = [...initial];

  // MAP-19: a first page filtered down to nothing renders the empty state,
  // and the sentinel is not mounted alongside it — so nothing would ever ask
  // for page 2 and "no cars found" would be permanent. Keep going until a
  // round yields something or the sources run out.
  while (collected.length === 0 && hasMorePages(state)) {
    const round = await fetchNextRound(params, state);
    if (searchVersionRef.current !== version) return { aborted: true, collected, state };
    state = round.state;
    collected.push(...round.listings);
  }

  return { aborted: false, collected, state };
}

export function useListingsSearch() {
  // Failure copy has to come from the i18n context, not string literals: the
  // default locale is Spanish, so hardcoded English was reaching most users.
  const { t } = useTranslation();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const pageRef = useRef<PageState>(EMPTY_PAGE);
  const lastParamsRef = useRef<SearchInput | null>(null);
  const isLoadingMoreRef = useRef(false);
  const searchVersionRef = useRef(0);

  const applyHasMore = useCallback((state: PageState) => {
    setHasMore(hasMorePages(state));
  }, []);

  async function search(input: SearchInput) {
    const version = ++searchVersionRef.current;

    const sanitized = { ...input, keywords: input.keywords?.trim() };
    const parsed = searchSchema.safeParse(sanitized);

    if (!parsed.success) {
      // Zod issue messages are English prose written for developers. The user
      // gets one localised sentence; the detail is not actionable for them.
      toast.error(t.map.invalidSearch);
      return;
    }

    const params = parsed.data;
    const cacheKey = JSON.stringify(params);

    const cached = getCached<CarListing[]>(cacheKey);
    if (cached) {
      applyCachedSearch(cached, params, version, {
        searchVersionRef,
        pageRef,
        lastParamsRef,
        setHasMore,
        setListings,
      });
      return;
    }

    if (searchVersionRef.current !== version) return;
    setIsLoading(true);
    pageRef.current = EMPTY_PAGE;
    setHasMore(false);

    const { wpResult, cnResult, mnResult, allRejected } = await fetchInitialResults(params);
    if (searchVersionRef.current !== version) return;

    if (allRejected) {
      toast.error(t.map.searchFailed);
      setIsLoading(false);
      return;
    }

    // MAP-16/17/18: only Wallapop honours the radius upstream and only the
    // structured sources honour the model, so the filter promises are
    // enforced here, where the lists meet.
    const {
      listings: initialListings,
      cnData,
      mnData,
    } = collectRoundResults(wpResult, cnResult, mnResult, params);
    const initialState = advancePageState(
      EMPTY_PAGE,
      { wallapop: true, cochesNet: true, milanuncios: true },
      wpResult,
      cnData,
      mnData,
    );

    const paginationResult = await runPaginationUntilResults(
      params,
      initialListings,
      initialState,
      version,
      searchVersionRef,
    );
    if (paginationResult.aborted) return;

    pageRef.current = paginationResult.state;
    lastParamsRef.current = params;
    setListings(paginationResult.collected);
    setCached(cacheKey, paginationResult.collected);
    applyHasMore(paginationResult.state);
    setIsLoading(false);
  }

  const loadMore = useCallback(async () => {
    const params = lastParamsRef.current;
    if (isLoadingMoreRef.current || !params) return;
    if (!hasMorePages(pageRef.current)) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      let state = pageRef.current;
      const collected: CarListing[] = [];

      // MAP-19: appending nothing would strand the scroll. The list does not
      // grow, so the sentinel neither unmounts nor leaves the viewport, and
      // IntersectionObserver reports crossings rather than states — it will
      // not fire again. A filtered-away page has to be retried from here.
      do {
        const round = await fetchNextRound(params, state);
        state = round.state;
        collected.push(...round.listings);
      } while (collected.length === 0 && hasMorePages(state));

      pageRef.current = state;
      if (collected.length > 0) {
        setListings((prev) => [...prev, ...collected]);
      }
      applyHasMore(state);
    } catch {
      toast.error(t.map.loadMoreFailed);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [applyHasMore, t]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMoreRef.current) {
            loadMore();
          }
        },
        { rootMargin: "200px" },
      );
      observerRef.current.observe(node);
    },
    [loadMore],
  );

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return {
    listings,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    sentinelRef,
  };
}
