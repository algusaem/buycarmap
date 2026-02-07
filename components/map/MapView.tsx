"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { ListingsHeader } from "@/components/map/ListingsHeader";
import { CarListingCard } from "@/components/map/CarListingCard";
import { MobileMapOverlay } from "@/components/map/MobileMapOverlay";
import { useListingsSearch } from "@/lib/hooks/useListingsSearch";
import { useSearchFilters } from "@/lib/hooks/useSearchFilters";
import { useTranslation } from "@/lib/i18n/client";

const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

export function MapView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const { listings, isLoading, isLoadingMore, nextPage, search, sentinelRef } =
    useListingsSearch();

  const getKeywords = useCallback(() => searchQuery, [searchQuery]);
  const filters = useSearchFilters(search, getKeywords);

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
          engine={filters.engine}
          gearbox={filters.gearbox}
          brand={filters.brand}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          minKm={filters.minKm}
          maxKm={filters.maxKm}
          minYear={filters.minYear}
          maxYear={filters.maxYear}
          minHorsePower={filters.minHorsePower}
          maxHorsePower={filters.maxHorsePower}
          timeFilter={filters.timeFilter}
          onEngineChange={filters.setEngine}
          onGearboxChange={filters.setGearbox}
          onBrandChange={filters.setBrand}
          onMinPriceChange={filters.setMinPrice}
          onMaxPriceChange={filters.setMaxPrice}
          onMinKmChange={filters.setMinKm}
          onMaxKmChange={filters.setMaxKm}
          onMinYearChange={filters.setMinYear}
          onMaxYearChange={filters.setMaxYear}
          onMinHorsePowerChange={filters.setMinHorsePower}
          onMaxHorsePowerChange={filters.setMaxHorsePower}
          onTimeFilterChange={filters.setTimeFilter}
          onClearFilters={filters.clearAll}
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
