"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ListingsHeader } from "@/components/map/ListingsHeader";
import { CarListingCard } from "@/components/map/CarListingCard";
import { ListingsSkeleton } from "@/components/map/ListingsSkeleton";
import { MobileMapOverlay } from "@/components/map/MobileMapOverlay";
import { Button } from "@/components/ui/button";
import { useListingsSearch } from "@/lib/hooks/useListingsSearch";
import { useSearchFilters } from "@/lib/hooks/useSearchFilters";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useTranslations } from "next-intl";
import type { SearchFiltersProps } from "@/components/map/SearchFilters";

const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

interface MapViewProps {
  initialQuery?: string;
}

export function MapView({ initialQuery = "" }: MapViewProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [showMap, setShowMap] = useState(false);
  const {
    listings,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    resultsGeneration,
    search,
    retry,
    sentinelRef,
  } = useListingsSearch();
  // Results know nothing about what this user saved; without this every card
  // renders unsaved even for a car already in their favorites.
  const { favoriteIds, setFavorite } = useFavorites();

  const getKeywords = useCallback(() => searchQuery, [searchQuery]);
  const filters = useSearchFilters(search, getKeywords);

  const filterProps = useMemo<SearchFiltersProps>(
    () => ({
      engine: filters.engine,
      gearbox: filters.gearbox,
      brand: filters.brand,
      model: filters.model,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minKm: filters.minKm,
      maxKm: filters.maxKm,
      minYear: filters.minYear,
      maxYear: filters.maxYear,
      minHorsePower: filters.minHorsePower,
      maxHorsePower: filters.maxHorsePower,
      timeFilter: filters.timeFilter,
      selectedLocation: filters.selectedLocation,
      distanceInKm: filters.distanceInKm,
      onEngineChange: filters.setEngine,
      onGearboxChange: filters.setGearbox,
      onBrandChange: filters.setBrand,
      onModelChange: filters.setModel,
      onMinPriceChange: filters.setMinPrice,
      onMaxPriceChange: filters.setMaxPrice,
      onMinKmChange: filters.setMinKm,
      onMaxKmChange: filters.setMaxKm,
      onMinYearChange: filters.setMinYear,
      onMaxYearChange: filters.setMaxYear,
      onMinHorsePowerChange: filters.setMinHorsePower,
      onMaxHorsePowerChange: filters.setMaxHorsePower,
      onTimeFilterChange: filters.setTimeFilter,
      onLocationChange: filters.setLocation,
      onDistanceChange: filters.setDistanceInKm,
      onClearAll: filters.clearAll,
    }),
    [filters],
  );

  return (
    <div className="flex h-0 min-h-0 flex-1 overflow-hidden">
      {/* Left - Listings Panel */}
      <div className="flex h-full w-full flex-col border-r border-border/50 lg:w-200">
        <ListingsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={filters.triggerSearch}
          onShowMap={() => setShowMap(true)}
          isLoading={isLoading}
          filtersOpen={filters.isOpen}
          onToggleFilters={filters.toggle}
          activeFilterCount={filters.activeCount}
          filterProps={filterProps}
        />

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <ListingsSkeleton />
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">{t("map.searchFailed")}</p>
              <Button onClick={retry}>{t("errors.retry")}</Button>
            </div>
          ) : listings.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{t("map.emptyState")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {listings.map((listing) => (
                  <CarListingCard
                    key={listing.id}
                    {...listing}
                    isFavorite={favoriteIds.has(listing.id)}
                    onFavoriteChange={setFavorite}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="mt-6 flex justify-center py-4">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{t("map.loading")}</span>
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
          <ListingsMap listings={listings} resultsGeneration={resultsGeneration} />
        </div>
      </div>

      {/* Mobile map */}
      {showMap && (
        <MobileMapOverlay onClose={() => setShowMap(false)}>
          <ListingsMap listings={listings} resultsGeneration={resultsGeneration} />
        </MobileMapOverlay>
      )}
    </div>
  );
}
