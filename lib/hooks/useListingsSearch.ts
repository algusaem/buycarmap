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
function filterByModel(
  listings: CarListing[],
  model: string | undefined,
): CarListing[] {
  const wanted = model?.trim().toLowerCase();
  if (!wanted) return listings;
  return listings.filter(
    (listing) =>
      listing.model.toLowerCase().includes(wanted) ||
      listing.title.toLowerCase().includes(wanted),
  );
}

// Every filter the sources cannot be trusted to enforce upstream, applied
// where the three result lists meet (MAP-16, MAP-17, MAP-18).
function applyResultFilters(
  listings: CarListing[],
  params: SearchInput,
): CarListing[] {
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
  return (
    state.wallapopNext !== null ||
    state.cochesNetHasMore ||
    state.milanunciosHasMore
  );
}

interface RoundResult {
  listings: CarListing[];
  state: PageState;
}

// One round of pagination: the next page from every source that still has one,
// normalized, merged and filtered, with the page state advanced past it.
async function fetchNextRound(
  params: SearchInput,
  state: PageState,
): Promise<RoundResult> {
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

  return {
    listings: applyResultFilters(
      interleave([wpItems, cnItems, mnItems]),
      params,
    ),
    state: {
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
    },
  };
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

    // MAP-16/17/18: only Wallapop honours the radius upstream and only the
    // structured sources honour the model, so the filter promises are
    // enforced here, where the lists meet.
    const collected = applyResultFilters(
      interleave([wpItems, cnItems, mnItems]),
      params,
    );
    let nextState: PageState = {
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

    // MAP-19: a first page filtered down to nothing renders the empty state,
    // and the sentinel is not mounted alongside it — so nothing would ever ask
    // for page 2 and "no cars found" would be permanent. Keep going until a
    // round yields something or the sources run out.
    while (collected.length === 0 && hasMorePages(nextState)) {
      const round = await fetchNextRound(params, nextState);
      if (searchVersionRef.current !== version) return;
      nextState = round.state;
      collected.push(...round.listings);
    }

    pageRef.current = nextState;
    lastParamsRef.current = params;
    setListings(collected);
    setCached(cacheKey, collected);
    applyHasMore(nextState);
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
