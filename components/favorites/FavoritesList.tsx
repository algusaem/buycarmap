"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SavedCarSheet } from "@/components/favorites/SavedCarSheet";
import { SavedColumn, SavedHeading, SavedMapFrame } from "@/components/favorites/SavedLayout";
import { SavedList } from "@/components/favorites/SavedList";
import { SavedPagePlaceholder } from "@/components/favorites/SavedPlaceholders";
import { SortChips } from "@/components/favorites/SortChips";
import { MapPill } from "@/components/map/ResultsStates";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CarListing } from "@/interfaces/listing";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useRemovalFocus } from "@/lib/hooks/useRemovalFocus";
import { useSavedCars } from "@/lib/hooks/useSavedCars";
import { useSavedCarSheet } from "@/lib/hooks/useSavedCarSheet";
import { useSavedColumns } from "@/lib/hooks/useSavedColumns";
import { useSavedList } from "@/lib/hooks/useSavedList";
import { useSavedPins } from "@/lib/hooks/useSavedPins";

// MapLibre cannot run server-side (as in components/map/MapResultsArea.tsx).
const ListingsMap = dynamic(
  async () => (await import("@/components/map/ListingsMap")).ListingsMap,
  { ssr: false },
);

// docs/specs/redesign-saved.md (SAVED); docs/specs/favorites.md (FAV-13,
// FAV-14). The /favorites page under its route frame: «Guardados», the sort
// chips, the virtualised list and, from `lg`, the saved map with its pins and
// pill. At phone width the list is compact rows that open the car sheet.
// Removing a car takes it out at once and offers «Deshacer» in a toast; the
// failures come back from lib/hooks/useSavedCars.ts as copy and are toasted
// here (FRONT-15). Leaving the page dismisses its removal toasts, so
// «Deshacer» is never offered where its outcome could not be shown. The list
// never animates (MOTION-9): a removed car, an undone one, the sort chips and
// the switch between the list and the empty state all change at once.
//
// The composition switches by media query, not by CSS alone: the virtualiser
// needs a row and a column count. Until the client has read those queries
// (the server render and hydration) the page draws the loading placeholders,
// whose two compositions CSS picks between, so a phone never paints the
// desktop cards first.

/** The removal toast stays 8 seconds, so a keyboard user has time to reach «Deshacer» (redesign-saved.md › Edge cases). */
const REMOVAL_TOAST_MS = 8000;

interface FavoritesListProps {
  favorites: CarListing[];
}

export function FavoritesList({ favorites }: FavoritesListProps) {
  const t = useTranslations();
  const isPhone = useIsPhone();
  const columns = useSavedColumns();
  const { sort, setSort, shown, savedIds, remove, undo } = useSavedCars(favorites, isPhone);
  const pins = useSavedPins(shown);
  const list = useSavedList({ shown, columns });
  const sheet = useSavedCarSheet();
  // No WebGL: the map's own «map unavailable» pill is the only one over it (MAPLIBRE-15).
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const removalFocus = useRemovalFocus({
    shown,
    scrollToCar: list.scrollToCar,
    returnFocusRef: sheet.returnFocusRef,
    listRef: list.scrollerRef,
  });

  // SAVED-14, edge cases: the «Quitado de guardados» toasts still up, dismissed
  // when the page goes.
  const removalToastsRef = useRef(new Set<string | number>());
  useEffect(() => {
    const removalToasts = removalToastsRef.current;
    return () => {
      for (const id of removalToasts) toast.dismiss(id);
    };
  }, []);

  async function handleUndo(listing: CarListing) {
    const { applied, failure } = undo(listing);
    if (applied) {
      // SAVED-22: a removal that emptied the list no longer sends the focus
      // to the empty state.
      removalFocus.cancelEmptyFocus();
    }
    const message = await failure;
    if (message) toast.error(message);
  }

  async function toastFailure(failure: Promise<string | null>, removedToast: string | number) {
    const message = await failure;
    if (!message) return;
    removalToastsRef.current.delete(removedToast);
    toast.dismiss(removedToast);
    toast.error(message);
  }

  /** Removes a car at once (SAVED-14, SAVED-22); false when nothing happened (FAV-18: the session is still resolving). */
  function handleRemove(listing: CarListing): boolean {
    const index = shown.findIndex((car) => car.id === listing.id);
    // A car no longer shown (a second press that reaches it after its removal) has nothing to remove.
    if (index === -1) return false;
    const neighbour = shown[index + 1] ?? shown[index - 1];
    const { applied, failure } = remove(listing);
    if (!applied) return false;
    removalFocus.focusAfterRemoval(neighbour);
    const removedToast = toast.success(t("favorites.removed"), {
      duration: REMOVAL_TOAST_MS,
      action: { label: t("favorites.undo"), onClick: () => void handleUndo(listing) },
    });
    removalToastsRef.current.add(removedToast);
    void toastFailure(failure, removedToast);
    return true;
  }

  const empty = shown.length === 0;

  if (!list.resolved) return <SavedPagePlaceholder />;

  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn ref={list.scrollerRef} onScroll={list.recordScroll}>
        <SavedHeading chips={!isPhone && !empty && <SortChips sort={sort} onChange={setSort} />} />
        {empty && (
          <div className="pt-4.5 lg:pt-14">
            <EmptyState
              question={t("favorites.emptyTitle")}
              punchline={t("favorites.emptyPunchline")}
              line={isPhone ? t("favorites.emptyLinePhone") : t("favorites.emptyLine")}
              headingRef={removalFocus.emptyHeadingRef}
            >
              <Button asChild variant="primary" size="48">
                <Link href="/map">{t("favorites.emptyCta")}</Link>
              </Button>
            </EmptyState>
          </div>
        )}
        {!empty && (
          <SavedList
            listRef={list.listRef}
            virtualizer={list.virtualizer}
            scrollMargin={list.scrollMargin}
            listings={shown}
            columns={columns}
            activeIds={pins.activeIds}
            onActiveChange={pins.setHoverId}
            savedIds={savedIds}
            onToggleSaved={handleRemove}
            onOpen={sheet.openSheet}
            onRowFocus={list.focusRow}
          />
        )}
      </SavedColumn>

      {!isPhone && (
        <SavedMapFrame>
          <ListingsMap
            listings={shown}
            activeId={pins.activeId}
            previewId={pins.previewId}
            onActivate={(listingId) => list.scrollToCar(pins.activatePin(listingId))}
            onPreviewClose={pins.closePreview}
            favoriteIds={savedIds}
            onToggleFavorite={handleRemove}
            onUnavailableChange={setMapUnavailable}
          />
          {!mapUnavailable && (
            <MapPill
              text={empty ? t("favorites.mapEmpty") : t("favorites.mapTitle")}
              live={empty}
            />
          )}
        </SavedMapFrame>
      )}

      {isPhone && (
        <SavedCarSheet
          listing={sheet.listing}
          open={sheet.open}
          onClose={sheet.closeSheet}
          saved
          onToggleSaved={(listing) => {
            // SAVED-22: the sheet closes on a removal that was applied; while
            // the session resolves nothing happens, and it stays (FAV-18).
            if (handleRemove(listing)) sheet.closeSheet();
          }}
          returnFocusRef={sheet.returnFocusRef}
        />
      )}
    </div>
  );
}
