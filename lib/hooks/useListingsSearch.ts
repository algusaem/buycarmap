import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CarListing } from "@/interfaces/listing";
import { searchSchema, SearchInput } from "@/lib/validations/search";
import { searchWallapop } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { getCached, setCached } from "@/lib/wallapop/cache";

export function useListingsSearch() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const nextPageRef = useRef<string | null>(null);
  const lastParamsRef = useRef<SearchInput | null>(null);
  const isLoadingMoreRef = useRef(false);

  async function search(query: string) {
    if (!query.trim()) return;

    const input = { keywords: query.trim() };
    const parsed = searchSchema.safeParse(input);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const params = parsed.data;
    const cacheKey = JSON.stringify(params);

    const cached = getCached<CarListing[]>(cacheKey);
    if (cached) {
      setListings(cached);
      return;
    }

    setIsLoading(true);
    setNextPage(null);
    nextPageRef.current = null;

    try {
      const response = await searchWallapop(params);
      const items = response.data?.section?.items ?? [];
      const normalized = normalizeWallapopItems(items);

      setCached(cacheKey, normalized);
      setListings(normalized);
      const next = response.meta?.next_page ?? null;
      setNextPage(next);
      nextPageRef.current = next;
      lastParamsRef.current = params;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch listings";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !lastParamsRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const token = nextPageRef.current;
      if (!token) return;

      const response = await searchWallapop(lastParamsRef.current, token);
      const items = response.data?.section?.items ?? [];
      const normalized = normalizeWallapopItems(items);

      setListings((prev) => [...prev, ...normalized]);
      const next = response.meta?.next_page ?? null;
      setNextPage(next);
      nextPageRef.current = next;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load more listings";
      toast.error(message);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, []);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            nextPageRef.current &&
            !isLoadingMoreRef.current
          ) {
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
    nextPage,
    search,
    sentinelRef,
  };
}
