"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PhoneSearchBar } from "@/components/map/phone/PhoneSearchBar";
import { ResultsSheet } from "@/components/map/phone/ResultsSheet";
import { LoadingMore, ResultsStatus, StatusPill } from "@/components/map/ResultsStates";
import type { CarListing } from "@/interfaces/listing";
import type { useListingsSearch } from "@/lib/hooks/useListingsSearch";
import type { MapPageState } from "@/lib/hooks/useMapPageState";
import type { ResultsState } from "@/lib/map/results-state";
import type { MapZone } from "@/lib/map/zone";
import type { PhoneSummary } from "@/lib/search/phone-summary";
import type { SearchInput } from "@/lib/search/schema";

// MapLibre cannot run server-side; `ssr: false` keeps it out of the server
// bundle (moved here from MapView.tsx with the one place that renders it).
const ListingsMap = dynamic(
  () => import("@/components/map/ListingsMap").then((mod) => mod.ListingsMap),
  { ssr: false },
);

// docs/specs/redesign-map.md (MAPUI-20, MAPUI-23, MAPUI-27 to MAPUI-33,
// MAPUI-62, MAPUI-65, MAPUI-67). The list-and-map area MapView wires up: on a phone,
// the `surface` band across the top with the search summary, «Filtros» and
// the quick filters, its top padding clear of the notch, and under it the map
// with the results sheet over it; from `lg`, a row 48px from each side whose
// two equal halves, 48px apart, are the results sheet as the list column and
// the map, a `card`-radius card 24px clear of the header band and of the
// window's bottom. The page's UI state arrives as `page`
// (lib/hooks/useMapPageState.ts) and the search's as `results`
// (lib/hooks/useListingsSearch.ts).

interface MapResultsAreaProps {
  isPhone: boolean;
  page: MapPageState;
  results: ReturnType<typeof useListingsSearch>;
  summary: PhoneSummary;
  input: SearchInput;
  onApplyQuick: (patch: Partial<SearchInput>) => void;
  heading: string;
  state: ResultsState;
  widenTo: number | undefined;
  distanceInKm: number;
  /** The circle around the browser's position while it stands in for a place (MAP-34). */
  zone?: MapZone;
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
  onApplyQuick,
  heading,
  state,
  widenTo,
  distanceInKm,
  zone,
  hasFilters,
  onWiden,
  onClearFilters,
  onAllSpain,
  favoriteIds,
  onToggleFavorite,
}: MapResultsAreaProps) {
  const t = useTranslations();
  // No WebGL: the map's own «map unavailable» pill is the only one over it (MAPLIBRE-15).
  const [mapUnavailable, setMapUnavailable] = useState(false);
  // Where the phone results sheet's top edge rests: the pins and the
  // attribution under it leave the tab order (A11Y-4).
  const [sheetTop, setSheetTop] = useState<number | null>(null);

  return (
    // `isolate` keeps the sheet's z-index inside this area, under the tab bar and the dialogs
    // portalled to the body.
    <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-clip">
      {/* Phone: the band with the search summary, «Filtros» and the quick filters, clear of the notch and the rounded corners (MAPUI-20, MAPUI-67). */}
      <div data-testid="phone-map-band" className="shrink-0 bg-surface pt-band-top pb-3 lg:hidden">
        <PhoneSearchBar
          placeSummary={summary.placeSummary}
          carPriceSummary={summary.carPriceSummary}
          input={input}
          onOpenSearch={page.openSearchSheet}
          onOpenFilters={page.openPhoneFilters}
          onApplyQuick={onApplyQuick}
          filtersOpen={page.phoneFiltersOpen}
          searchRef={page.searchOpenerRef}
          filtersRef={page.filtersOpenerRef}
        />
      </div>

      {/* Under the band on a phone; the list-and-map row on desktop (MAPUI-65). */}
      <div className="relative flex min-h-0 flex-1 lg:gap-12 lg:px-12">
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
          onRestingTopChange={setSheetTop}
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
          className="absolute inset-0 lg:relative lg:my-6 lg:min-w-0 lg:flex-1 lg:overflow-hidden lg:rounded-card"
        >
          <ListingsMap
            listings={results.listings}
            resultsGeneration={results.resultsGeneration}
            zone={zone}
            activeId={page.activeId}
            previewId={page.previewId}
            onActivate={page.activatePin}
            onPreviewClose={page.closePreview}
            onMapInteract={isPhone ? page.lowerSheetOnMapInteract : undefined}
            desktop={!isPhone}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            onUnavailableChange={setMapUnavailable}
            coveredFrom={isPhone ? sheetTop : null}
          />
          {!mapUnavailable && (
            <StatusPill
              state={state}
              radiusKm={distanceInKm}
              canWiden={widenTo !== undefined}
              hasFilters={hasFilters}
            />
          )}
        </section>
      </div>
    </div>
  );
}
