"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PhoneSearchBar } from "@/components/map/phone/PhoneSearchBar";
import { ResultsSheet } from "@/components/map/phone/ResultsSheet";
import { LoadingMore, ResultsStatus, StatusPill } from "@/components/map/ResultsStates";
import type { CarListing } from "@/interfaces/listing";
import type { useListingsSearch } from "@/lib/hooks/useListingsSearch";
import type { MapPageState } from "@/lib/hooks/useMapPageState";
import type { ResultsState } from "@/lib/map/results-state";
import type { ChipKey } from "@/lib/search/filter-chips";
import type { PhoneSummary } from "@/lib/search/phone-summary";
import type { SearchInput } from "@/lib/search/schema";

// Leaflet cannot run server-side; `ssr: false` keeps it out of the server
// bundle (moved here from MapView.tsx with the one place that renders it).
const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

// docs/specs/redesign-map.md (MAPUI-20, MAPUI-23, MAPUI-27 to MAPUI-33, MAPUI-62). The
// list-and-map column MapView wires up: the phone search summary floating
// over the map, the results sheet (the list column at desktop width), and
// the map section with its pins and desktop status pill. The page's UI state
// arrives as `page` (lib/hooks/useMapPageState.ts) and the search's as
// `results` (lib/hooks/useListingsSearch.ts).

interface MapResultsAreaProps {
  isPhone: boolean;
  page: MapPageState;
  results: ReturnType<typeof useListingsSearch>;
  summary: PhoneSummary;
  input: SearchInput;
  onRemoveChip: (key: ChipKey) => void;
  heading: string;
  state: ResultsState;
  widenTo: number | undefined;
  distanceInKm: number;
  hasFilters: boolean;
  onWiden: () => void;
  onClearFilters: () => void;
  onAllSpain: () => void;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (listing: CarListing, next: boolean) => void;
}

export function MapResultsArea({
  isPhone,
  page,
  results,
  summary,
  input,
  onRemoveChip,
  heading,
  state,
  widenTo,
  distanceInKm,
  hasFilters,
  onWiden,
  onClearFilters,
  onAllSpain,
  favoriteIds,
  onToggleFavorite,
}: MapResultsAreaProps) {
  const t = useTranslations();

  return (
    // `isolate` keeps the sheet's and the floating search's z-indexes inside this area, under the
    // tab bar and the dialogs portalled to the body.
    <div className="relative isolate flex min-h-0 flex-1 overflow-clip">
      {/* Phone: the search summary and the filters row, floating over the map, clear of the notch and the rounded corners (MAPUI-20). */}
      <div className="absolute top-float-top right-float-right left-float-left z-500 lg:hidden">
        <PhoneSearchBar
          placeSummary={summary.placeSummary}
          carPriceSummary={summary.carPriceSummary}
          input={input}
          onOpenSearch={page.openSearchSheet}
          onOpenFilters={page.openPhoneFilters}
          onRemoveChip={onRemoveChip}
          filtersOpen={page.phoneFiltersOpen}
          searchRef={page.searchOpenerRef}
          filtersRef={page.filtersOpenerRef}
        />
      </div>

      {/* The list column on desktop, the results sheet over the map on a phone (MAPUI-23, MAPUI-33). */}
      <ResultsSheet
        heading={heading}
        position={page.sheetPosition}
        onPositionChange={page.setSheetPosition}
        listings={page.sheetListings}
        onCreateAlert={() => page.openAlert("sheet")}
        createAlertRef={page.alertOpenerRef}
        docked={!isPhone}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
        activeId={page.activeId}
        onActiveChange={page.setHoverId}
        status={
          state !== "ready" && (
            <ResultsStatus
              state={state}
              widenTo={widenTo}
              radiusKm={distanceInKm}
              hasFilters={hasFilters}
              onRetry={results.retry}
              onWiden={onWiden}
              onClearFilters={onClearFilters}
              onAllSpain={onAllSpain}
            />
          )
        }
        footer={
          results.hasMore && (
            <div ref={results.sentinelRef} className="mt-6 flex justify-center py-4">
              <LoadingMore loading={results.isLoadingMore} />
            </div>
          )
        }
      />

      <section
        aria-label={t("nav.map")}
        className="absolute inset-0 lg:relative lg:flex-1 lg:border-l lg:border-line-soft"
      >
        <ListingsMap
          listings={results.listings}
          resultsGeneration={results.resultsGeneration}
          activeId={page.activeId}
          previewId={page.previewId}
          onActivate={page.activatePin}
          onPreviewClose={page.closePreview}
          onMapInteract={isPhone ? page.lowerSheetOnMapInteract : undefined}
          desktop={!isPhone}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
        />
        <StatusPill
          state={state}
          radiusKm={distanceInKm}
          canWiden={widenTo !== undefined}
          hasFilters={hasFilters}
        />
      </section>
    </div>
  );
}
