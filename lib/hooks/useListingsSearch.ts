import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CarListing } from "@/interfaces/listing";
import type { WallapopSearchResponse } from "@/interfaces/wallapop";
import type { CochesNetSearchResponse } from "@/interfaces/cochesnet";
import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import { searchSchema, type SearchInput } from "@/lib/search/schema";
import { searchWallapop } from "@/lib/wallapop/client";
import { searchCochesNet } from "@/lib/cochesnet/client";
import { searchMilanuncios } from "@/lib/milanuncios/client";
import { getCached, setCached } from "@/lib/wallapop/cache";
import { useTranslation } from "@/lib/i18n/client";
import {
  type PageState,
  EMPTY_PAGE,
  hasMorePages,
  collectRoundResults,
  advancePageState,
} from "@/lib/listings/merge";

interface RoundResult {
  listings: CarListing[];
  state: PageState;
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
