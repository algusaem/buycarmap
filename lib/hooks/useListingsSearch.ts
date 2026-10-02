import { useCallback, useEffect, useRef, useState } from "react";
import type { CarListing } from "@/interfaces/listing";
import { searchSchema, type SearchInput } from "@/lib/search/schema";
import { searchListings } from "@/server/search/actions";
import { EMPTY_SEARCH_CURSORS, type SearchCursors } from "@/server/search/schema";
import { getCached, setCached } from "@/lib/wallapop/cache";
import { hasAnyMore } from "@/lib/listings/merge";

// FRONT-3 (docs/specs/core-frontend.md): the hook keeps the request
// lifecycle — validation, caching, the version guard against a stale
// response, and the "fetch until a round yields a listing or the sources run
// out" loop (MAP-19) — but each round is now one `searchListings` Server
// Action call instead of three direct fetches. A failed round is never a
// toast (FRONT-15); the caller (MapView) renders the inline error state
// FRONT-14 describes, with a Retry that calls `search` again.

interface RoundOutcome {
  listings: CarListing[];
  cursors: SearchCursors;
  more: boolean;
}

/** One round against the shared search action. Throws on a rejected Result
 * (invalid input or rate-limited) so the caller's try/catch can surface it. */
const SOURCE_COUNT = 3;

async function runRound(params: SearchInput, cursors: SearchCursors): Promise<RoundOutcome> {
  const result = await searchListings(params, cursors);
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  // Every source failing is "no information", not "no cars found" — the
  // FRONT-14 error state (with Retry), not the empty state.
  if (result.value.failedSources.length >= SOURCE_COUNT) {
    throw new Error("everySourceFailed");
  }
  return {
    listings: result.value.listings,
    cursors: result.value.cursors,
    more: hasAnyMore(result.value.hasMore),
  };
}

interface PaginationRunResult {
  aborted: boolean;
  collected: CarListing[];
  cursors: SearchCursors;
  more: boolean;
}

// Keeps fetching rounds until one yields a listing or the sources run out
// (MAP-19), bailing out early if a newer search has superseded this one.
async function runPaginationUntilResults(
  params: SearchInput,
  initial: RoundOutcome,
  version: number,
  searchVersionRef: { current: number },
): Promise<PaginationRunResult> {
  let collected = [...initial.listings];
  let cursors = initial.cursors;
  let more = initial.more;

  // MAP-19: a first page filtered down to nothing renders the empty state,
  // and the sentinel is not mounted alongside it — so nothing would ever ask
  // for the next round and "no cars found" would be permanent. Keep going
  // until a round yields something or the sources run out.
  while (collected.length === 0 && more) {
    const round = await runRound(params, cursors);
    if (searchVersionRef.current !== version) return { aborted: true, collected, cursors, more };
    cursors = round.cursors;
    more = round.more;
    collected = round.listings;
  }

  return { aborted: false, collected, cursors, more };
}

interface SearchStateSetters {
  setListings: (value: CarListing[]) => void;
  setIsLoading: (value: boolean) => void;
  setHasMore: (value: boolean) => void;
  setError: (value: boolean) => void;
}

interface SearchRunContext {
  cursorsRef: { current: SearchCursors };
  lastParamsRef: { current: SearchInput | null };
  searchVersionRef: { current: number };
}

// The cache-hit branch of `search`: a repeat of an identical, still-fresh
// query resets pagination to this query's first page and skips the network
// entirely. Pulled out of `search` only to keep that function's branching
// readable — it is not reused anywhere else.
function applyCachedSearch(
  cached: CarListing[],
  params: SearchInput,
  version: number,
  ctx: SearchRunContext,
  setters: SearchStateSetters,
): void {
  if (ctx.searchVersionRef.current !== version) return;
  ctx.cursorsRef.current = EMPTY_SEARCH_CURSORS;
  ctx.lastParamsRef.current = params;
  setters.setError(false);
  setters.setHasMore(false);
  setters.setListings(cached);
}

// The network branch of `search`, once validation and the cache lookup are
// both behind it: run the first round, then keep paginating until a round
// yields a listing or the sources run out (MAP-19).
async function runSearchRounds(
  params: SearchInput,
  cacheKey: string,
  version: number,
  ctx: SearchRunContext,
  setters: SearchStateSetters,
): Promise<void> {
  try {
    const initial = await runRound(params, EMPTY_SEARCH_CURSORS);
    if (ctx.searchVersionRef.current !== version) return;

    const paginationResult = await runPaginationUntilResults(
      params,
      initial,
      version,
      ctx.searchVersionRef,
    );
    if (paginationResult.aborted) return;

    ctx.cursorsRef.current = paginationResult.cursors;
    setters.setListings(paginationResult.collected);
    setCached(cacheKey, paginationResult.collected);
    setters.setHasMore(paginationResult.more);
    setters.setIsLoading(false);
  } catch {
    if (ctx.searchVersionRef.current !== version) return;
    setters.setError(true);
    setters.setListings([]);
    setters.setHasMore(false);
    setters.setIsLoading(false);
  }
}

export function useListingsSearch() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);

  const cursorsRef = useRef<SearchCursors>(EMPTY_SEARCH_CURSORS);
  const lastParamsRef = useRef<SearchInput | null>(null);
  const isLoadingMoreRef = useRef(false);
  const searchVersionRef = useRef(0);

  const setters: SearchStateSetters = { setListings, setIsLoading, setHasMore, setError };
  const ctx: SearchRunContext = { cursorsRef, lastParamsRef, searchVersionRef };

  async function search(input: SearchInput) {
    const version = ++searchVersionRef.current;

    const sanitized = { ...input, keywords: input.keywords?.trim() };
    const parsed = searchSchema.safeParse(sanitized);

    if (!parsed.success) {
      lastParamsRef.current = sanitized;
      setError(true);
      setListings([]);
      setHasMore(false);
      return;
    }

    const params = parsed.data;
    const cacheKey = JSON.stringify(params);

    const cached = getCached<CarListing[]>(cacheKey);
    if (cached) {
      applyCachedSearch(cached, params, version, ctx, setters);
      return;
    }

    if (searchVersionRef.current !== version) return;
    setIsLoading(true);
    setError(false);
    cursorsRef.current = EMPTY_SEARCH_CURSORS;
    // Set before the round resolves, not just on success, so Retry (FRONT-14)
    // has something to re-run even when the very first round fails.
    lastParamsRef.current = params;
    setHasMore(false);

    await runSearchRounds(params, cacheKey, version, ctx, setters);
  }

  // Re-runs the last search from scratch — the Retry affordance FRONT-14's
  // error state offers. Not memoized: `search` is a plain function redefined
  // every render (like the rest of this hook), so there is no stable
  // reference to memoize against.
  function retry() {
    if (lastParamsRef.current) search(lastParamsRef.current);
  }

  const loadMore = useCallback(async () => {
    const params = lastParamsRef.current;
    if (isLoadingMoreRef.current || !params) return;
    if (!hasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      let cursors = cursorsRef.current;
      let collected: CarListing[] = [];
      let more = true;

      // MAP-19: appending nothing would strand the scroll. The list does not
      // grow, so the sentinel neither unmounts nor leaves the viewport, and
      // IntersectionObserver reports crossings rather than states — it will
      // not fire again. A filtered-away page has to be retried from here.
      do {
        const round = await runRound(params, cursors);
        cursors = round.cursors;
        more = round.more;
        collected = round.listings;
      } while (collected.length === 0 && more);

      cursorsRef.current = cursors;
      if (collected.length > 0) {
        setListings((prev) => [...prev, ...collected]);
      }
      setHasMore(more);
    } catch {
      // A failed read is never a toast (FRONT-15); the sentinel stays mounted
      // so scrolling back into view retries on its own.
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore]);

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
    error,
    search,
    retry,
    sentinelRef,
  };
}
