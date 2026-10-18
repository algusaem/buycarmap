"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreateAlert } from "@/components/alerts/CreateAlert";
import { FilterPanel } from "@/components/map/filters/FilterPanel";
import { MapResultsArea } from "@/components/map/MapResultsArea";
import { SearchSheet } from "@/components/map/phone/SearchSheet";
import { HeaderSearch } from "@/components/map/search/HeaderSearch";
import type { CarListing } from "@/interfaces/listing";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useListingsSearch } from "@/lib/hooks/useListingsSearch";
import { useMapPageState } from "@/lib/hooks/useMapPageState";
import { useSearchFilters } from "@/lib/hooks/useSearchFilters";
import { resultsHeading } from "@/lib/map/results-heading";
import { nextRadius, resultsState } from "@/lib/map/results-state";
import { phoneSummary } from "@/lib/search/phone-summary";

interface MapViewProps {
  initialQuery?: string;
}

export function MapView({ initialQuery = "" }: MapViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const results = useListingsSearch();
  const { listings, isLoading, error, hasMore, search } = results;
  // Results know nothing about what this user saved; without this every card
  // renders unsaved even for a car already in their favorites.
  const { favoriteIds, setFavorite } = useFavorites();
  const toggleFavorite = useFavoriteToggle();

  // MAPUI-18, amended by docs/specs/redesign-entry.md (ENTRY-6): `?q=` is
  // still parsed and searched for an old link, but no control shows or
  // edits it, and nothing in the app produces it any more.
  const getKeywords = useCallback(() => initialQuery, [initialQuery]);
  const filters = useSearchFilters(search, getKeywords);
  const { input } = filters;
  const place = filters.selectedLocation ?? null;

  const isPhone = useIsPhone();
  const page = useMapPageState(listings, isPhone);

  const summary = phoneSummary(input, place, filters.distanceInKm, { t, locale });

  async function handleToggleFavorite(listing: CarListing, next: boolean) {
    const failure = await toggleFavorite({
      listing,
      next,
      apply: (saved) => setFavorite(listing.id, saved),
      callbackPath: page.currentPath,
    });
    if (failure) toast.error(failure);
  }

  // No place and no filter, yet no car in all of Spain: the sources failed
  // without saying so, so the failed-search state shows (MAPUI-31, MAPUI-32;
  // spec Edge cases › No place).
  // The page searches on mount, so until the first search has landed (no
  // results generation yet, no error) the first page is loading, not empty
  // (MAPUI-30): the empty state never flashes before the search starts.
  const firstPagePending = results.resultsGeneration === 0 && !error;
  const searched = resultsState(isLoading || firstPagePending, error, listings.length);
  const state = searched === "empty" && !place && !filters.hasFilters ? "error" : searched;
  const widenTo = place ? nextRadius(filters.distanceInKm) : undefined;
  const heading = resultsHeading(
    {
      status: state === "loading" || state === "error" ? state : "ready",
      count: listings.length,
      hasMore,
    },
    { t, locale },
  );

  const createAlertProps = {
    criteria: input,
    placeName: place?.displayName,
    onClose: page.closeAlert,
  };

  // The page's main landmark, as in the route's error state (app/map/error.tsx).
  // `data-toast-anchor`: every toast here sits under the header band (12px,
  // MAPUI-59, SAVED-24), centred over the results list (app/globals.css).
  return (
    <main data-toast-anchor="map" className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      {/* Desktop: the search pill and «Crear alerta» in the map header's first row, «Filtros» and the quick filters in its second (MAPUI-1, MAPUI-13, MAPUI-19, MAPUI-39, MAPUI-58). */}
      <HeaderSearch
        filters={filters}
        createAlertOpen={page.alertOpen === "popover"}
        onCreateAlertOpenChange={(open) => (open ? page.openAlert("popover") : page.closeAlert())}
        createAlert={
          <CreateAlert {...createAlertProps} inline open={page.alertOpen === "popover"} />
        }
      />

      <MapResultsArea
        isPhone={isPhone}
        page={page}
        results={results}
        summary={summary}
        input={input}
        onApplyQuick={(patch) => filters.applyInput(patch)}
        heading={heading}
        state={state}
        widenTo={widenTo}
        distanceInKm={filters.distanceInKm}
        hasFilters={filters.hasFilters}
        onWiden={() => filters.applyInput({ distanceInKm: widenTo })}
        onClearFilters={filters.clearAll}
        onAllSpain={() => filters.applyInput({}, null)}
        favoriteIds={favoriteIds}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Phone: the «BUSCAR» sheet, the full-screen filters and «Crear alerta» (MAPUI-21, MAPUI-22, MAPUI-39). */}
      <SearchSheet
        open={page.searchSheetOpen}
        initial={input}
        place={place}
        radiusKm={filters.distanceInKm}
        onApply={({ place: chosenPlace, ...edited }) => {
          filters.applyInput(edited, chosenPlace);
          page.closeSearchSheet();
        }}
        onClose={page.closeSearchSheet}
        returnFocusRef={page.searchOpenerRef}
      />
      <FilterPanel
        mode="phone"
        open={page.phoneFiltersOpen}
        input={input}
        onChange={(patch) => filters.applyInput(patch)}
        onClear={filters.clearAll}
        onApply={page.closePhoneFilters}
        onDiscard={page.closePhoneFilters}
        returnFocusRef={page.filtersOpenerRef}
      />
      <CreateAlert
        {...createAlertProps}
        open={page.alertOpen === "sheet"}
        returnFocusRef={page.alertOpenerRef}
      />
    </main>
  );
}
