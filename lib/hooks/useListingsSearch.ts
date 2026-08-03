import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CarListing } from "@/interfaces/listing";
import { searchSchema, SearchInput } from "@/lib/validations/search";
import { searchWallapop } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { searchCochesNet } from "@/lib/cochesnet/client";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { searchMilanuncios } from "@/lib/milanuncios/client";
import { normalizeMilanunciosItems } from "@/lib/milanuncios/normalize";
import { getCached, setCached } from "@/lib/wallapop/cache";
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
    const more =
      state.wallapopNext !== null ||
      state.cochesNetHasMore ||
      state.milanunciosHasMore;
    setHasMore(more);
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

    const [wpResult, cnResult, mnResult] = await Promise.allSettled([
      searchWallapop(params),
      searchCochesNet(params, 1),
      searchMilanuncios(params, 1),
    ]);
    if (searchVersionRef.current !== version) return;

    if (
      wpResult.status === "rejected" &&
      cnResult.status === "rejected" &&
      mnResult.status === "rejected"
    ) {
      toast.error(t.map.searchFailed);
      setIsLoading(false);
      return;
    }

    const wpItems =
      wpResult.status === "fulfilled"
        ? normalizeWallapopItems(wpResult.value.data?.section?.items ?? [])
        : [];
    const cnData = cnResult.status === "fulfilled" ? cnResult.value : null;
    const cnItems = cnData ? normalizeCochesNetItems(cnData.items ?? []) : [];
    const mnData = mnResult.status === "fulfilled" ? mnResult.value : null;
    const mnItems = mnData ? normalizeMilanunciosItems(mnData.ads ?? []) : [];

    const merged = interleave([wpItems, cnItems, mnItems]);
    const nextState: PageState = {
      wallapopNext:
        wpResult.status === "fulfilled"
          ? (wpResult.value.meta?.next_page ?? null)
          : null,
      cochesNetPage: 1,
      cochesNetHasMore: cnData
        ? cnData.items.length > 0 && 1 < (cnData.meta?.totalPages ?? 1)
        : false,
      milanunciosPage: 1,
      milanunciosHasMore: mnData
        ? mnData.ads.length > 0 && 1 < (mnData.pagination?.totalPages ?? 1)
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
    if (
      state.wallapopNext === null &&
      !state.cochesNetHasMore &&
      !state.milanunciosHasMore
    )
      return;

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
      const mnPromise = state.milanunciosHasMore
        ? searchMilanuncios(params, state.milanunciosPage + 1)
        : null;

      const [wpResult, cnResult, mnResult] = await Promise.allSettled([
        wpPromise ?? Promise.resolve(null),
        cnPromise ?? Promise.resolve(null),
        mnPromise ?? Promise.resolve(null),
      ]);

      const wpItems =
        wpResult.status === "fulfilled" && wpResult.value
          ? normalizeWallapopItems(wpResult.value.data?.section?.items ?? [])
          : [];
      const cnData = cnResult.status === "fulfilled" ? cnResult.value : null;
      const cnItems = cnData ? normalizeCochesNetItems(cnData.items ?? []) : [];
      const mnData = mnResult.status === "fulfilled" ? mnResult.value : null;
      const mnItems = mnData ? normalizeMilanunciosItems(mnData.ads ?? []) : [];

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
        milanunciosPage: mnPromise
          ? state.milanunciosPage + 1
          : state.milanunciosPage,
        milanunciosHasMore: mnPromise
          ? !!mnData &&
            mnData.ads.length > 0 &&
            state.milanunciosPage + 1 < (mnData.pagination?.totalPages ?? 1)
          : state.milanunciosHasMore,
      };

      pageRef.current = nextState;
      setListings((prev) => [
        ...prev,
        ...interleave([wpItems, cnItems, mnItems]),
      ]);
      applyHasMore(nextState);
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
