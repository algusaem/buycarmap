import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CarListing } from "@/interfaces/listing";
import { searchSchema, SearchInput } from "@/lib/validations/search";
import { searchWallapop } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { searchCochesNet } from "@/lib/cochesnet/client";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { getCached, setCached } from "@/lib/wallapop/cache";

// Merge two source result lists by alternating, so both Wallapop and
// coches.net listings appear near the top instead of one source dominating.
function interleave(a: CarListing[], b: CarListing[]): CarListing[] {
  const merged: CarListing[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) merged.push(a[i]);
    if (i < b.length) merged.push(b[i]);
  }
  return merged;
}

interface PageState {
  wallapopNext: string | null;
  cochesNetPage: number;
  cochesNetHasMore: boolean;
}

const EMPTY_PAGE: PageState = {
  wallapopNext: null,
  cochesNetPage: 0,
  cochesNetHasMore: false,
};

export function useListingsSearch() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const pageRef = useRef<PageState>(EMPTY_PAGE);
  const lastParamsRef = useRef<SearchInput | null>(null);
  const isLoadingMoreRef = useRef(false);
  const searchVersionRef = useRef(0);

  const applyHasMore = useCallback((state: PageState) => {
    const more = state.wallapopNext !== null || state.cochesNetHasMore;
    setHasMore(more);
  }, []);

  async function search(input: SearchInput) {
    const version = ++searchVersionRef.current;

    const sanitized = { ...input, keywords: input.keywords?.trim() };
    const parsed = searchSchema.safeParse(sanitized);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const params = parsed.data;
    const cacheKey = JSON.stringify(params);

    const cached = getCached<CarListing[]>(cacheKey);
    if (cached) {
      if (searchVersionRef.current !== version) return;
      // The cache only holds page 1, so reset pagination to this query — else
      // the sentinel would keep paging with the previous search's params.
      pageRef.current = EMPTY_PAGE;
      lastParamsRef.current = params;
      setHasMore(false);
      setListings(cached);
      return;
    }

    if (searchVersionRef.current !== version) return;
    setIsLoading(true);
    pageRef.current = EMPTY_PAGE;
    setHasMore(false);

    const [wpResult, cnResult] = await Promise.allSettled([
      searchWallapop(params),
      searchCochesNet(params, 1),
    ]);
    if (searchVersionRef.current !== version) return;

    if (wpResult.status === "rejected" && cnResult.status === "rejected") {
      toast.error("Failed to fetch listings");
      setIsLoading(false);
      return;
    }

    const wpItems =
      wpResult.status === "fulfilled"
        ? normalizeWallapopItems(wpResult.value.data?.section?.items ?? [])
        : [];
    const cnData = cnResult.status === "fulfilled" ? cnResult.value : null;
    const cnItems = cnData ? normalizeCochesNetItems(cnData.items ?? []) : [];

    const merged = interleave(wpItems, cnItems);
    const nextState: PageState = {
      wallapopNext:
        wpResult.status === "fulfilled"
          ? (wpResult.value.meta?.next_page ?? null)
          : null,
      cochesNetPage: 1,
      cochesNetHasMore: cnData
        ? cnData.items.length > 0 && 1 < (cnData.meta?.totalPages ?? 1)
        : false,
    };

    pageRef.current = nextState;
    lastParamsRef.current = params;
    setListings(merged);
    setCached(cacheKey, merged);
    applyHasMore(nextState);
    setIsLoading(false);
  }

  const loadMore = useCallback(async () => {
    const params = lastParamsRef.current;
    if (isLoadingMoreRef.current || !params) return;
    const state = pageRef.current;
    if (state.wallapopNext === null && !state.cochesNetHasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const wpPromise =
        state.wallapopNext !== null
          ? searchWallapop(params, state.wallapopNext)
          : null;
      const cnPromise = state.cochesNetHasMore
        ? searchCochesNet(params, state.cochesNetPage + 1)
        : null;

      const [wpResult, cnResult] = await Promise.allSettled([
        wpPromise ?? Promise.resolve(null),
        cnPromise ?? Promise.resolve(null),
      ]);

      const wpItems =
        wpResult.status === "fulfilled" && wpResult.value
          ? normalizeWallapopItems(
              wpResult.value.data?.section?.items ?? [],
            )
          : [];
      const cnData =
        cnResult.status === "fulfilled" ? cnResult.value : null;
      const cnItems = cnData ? normalizeCochesNetItems(cnData.items ?? []) : [];

      const nextState: PageState = {
        wallapopNext: wpPromise
          ? wpResult.status === "fulfilled" && wpResult.value
            ? (wpResult.value.meta?.next_page ?? null)
            : null
          : state.wallapopNext,
        cochesNetPage: cnPromise ? state.cochesNetPage + 1 : state.cochesNetPage,
        cochesNetHasMore: cnPromise
          ? !!cnData &&
            cnData.items.length > 0 &&
            state.cochesNetPage + 1 < (cnData.meta?.totalPages ?? 1)
          : state.cochesNetHasMore,
      };

      pageRef.current = nextState;
      setListings((prev) => [...prev, ...interleave(wpItems, cnItems)]);
      applyHasMore(nextState);
    } catch {
      toast.error("Failed to load more listings");
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [applyHasMore]);

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
