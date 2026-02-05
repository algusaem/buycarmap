"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ListingsHeader } from "@/components/map/ListingsHeader";
import { CarListingCard } from "@/components/map/CarListingCard";
import { MobileMapOverlay } from "@/components/map/MobileMapOverlay";
import { CarListing } from "@/interfaces/listing";
import { searchSchema, SearchInput } from "@/lib/validations/search";
import { searchWallapop } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { getCached, setCached } from "@/lib/wallapop/cache";
import { useTranslation } from "@/lib/i18n/client";

const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

const DEFAULT_LAT = 40.4168;
const DEFAULT_LNG = -3.7038;

export function MapView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const nextPageRef = useRef<string | null>(null);
  const lastParamsRef = useRef<SearchInput | null>(null);

  async function handleSearch(query: string) {
    if (!query.trim()) return;

    const input = {
      keywords: query.trim(),
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
    };

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
      const normalized = normalizeWallapopItems(
        items,
        params.latitude,
        params.longitude,
      );

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

  const isLoadingMoreRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !lastParamsRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const token = nextPageRef.current;
      if (!token) return;

      const response = await searchWallapop(lastParamsRef.current, token);
      const items = response.data?.section?.items ?? [];
      const normalized = normalizeWallapopItems(
        items,
        lastParamsRef.current.latitude,
        lastParamsRef.current.longitude,
      );

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
          if (entries[0].isIntersecting && nextPageRef.current && !isLoadingMoreRef.current) {
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

  return (
    <div className="flex h-0 min-h-0 flex-1 overflow-hidden">
      {/* Left - Listings Panel */}
      <div className="flex h-full w-full flex-col border-r border-border/50 lg:w-200">
        <ListingsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onShowMap={() => setShowMap(true)}
          isLoading={isLoading}
        />

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t.map.searching}</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {t.map.emptyState}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {listings.map((listing) => (
                  <CarListingCard key={listing.id} {...listing} />
                ))}
              </div>
              {nextPage && (
                <div ref={sentinelRef} className="mt-6 flex justify-center py-4">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {t.map.loading}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right - Map */}
      <div className="hidden p-4 lg:flex lg:flex-1">
        <div className="h-full w-full overflow-hidden rounded-2xl border border-border/50">
          <ListingsMap listings={listings} />
        </div>
      </div>

      {/* Mobile map */}
      {showMap && (
        <MobileMapOverlay onClose={() => setShowMap(false)}>
          <ListingsMap listings={listings} />
        </MobileMapOverlay>
      )}
    </div>
  );
}
