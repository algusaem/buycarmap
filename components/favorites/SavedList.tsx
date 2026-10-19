"use client";

import type { Virtualizer } from "@tanstack/react-virtual";
import type { Ref } from "react";
import { SavedCard } from "@/components/favorites/SavedCard";
import { type RowTail, SavedRow } from "@/components/favorites/SavedRow";
import type { CarListing } from "@/interfaces/listing";
import type { SavedColumns } from "@/lib/hooks/useSavedColumns";
import { cn } from "@/lib/utils";

// docs/specs/redesign-saved.md (SAVED-9, SAVED-14, SAVED-19, SAVED-25 to
// SAVED-29): the virtualised list (lib/hooks/useSavedList.ts) drawn as rows of
// Guardados cards on desktop, 20px apart, or as compact rows on the phone.
// Each row sits at the offset the virtualiser gives it and is measured once
// drawn; the rows are in the DOM in their order, so Tab walks the cars in
// order. An alert's page (docs/specs/redesign-alerts.md, ALERTUI-20,
// ALERTUI-22, ALERTUI-51) draws its matches with the same list: there the
// heart toggles the buyer's favorites and the row has no city.
//
// The list never animates (MOTION-9): a removed car leaves in the same frame
// and the cars after it move up, and a car an undo brings back is drawn at
// once where it lands.

/** A row's grid by its column count: the phone's single compact row needs none. */
const ROW_GRID: Record<SavedColumns, string> = {
  1: "",
  2: "grid grid-cols-2 gap-x-5",
  3: "grid grid-cols-3 gap-x-5",
};

interface SavedItemProps {
  listing: CarListing;
  isPhone: boolean;
  rowTail: RowTail;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  saved: boolean;
  onToggleSaved: () => void;
  onOpen: (listing: CarListing, row: HTMLButtonElement) => void;
  onFocus: () => void;
}

/** A car as the list draws it: a compact row on the phone, a Guardados card on desktop. */
function SavedItem({
  listing,
  isPhone,
  rowTail,
  active,
  onActiveChange,
  saved,
  onToggleSaved,
  onOpen,
  onFocus,
}: SavedItemProps) {
  return (
    <>
      {isPhone && <SavedRow listing={listing} tail={rowTail} onOpen={onOpen} onFocus={onFocus} />}
      {!isPhone && (
        <SavedCard
          listing={listing}
          active={active}
          onActiveChange={onActiveChange}
          saved={saved}
          onToggleSaved={onToggleSaved}
          onFocus={onFocus}
        />
      )}
    </>
  );
}

interface SavedListProps {
  listRef: Ref<HTMLDivElement>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollMargin: number;
  listings: CarListing[];
  columns: SavedColumns;
  /** The cars whose pin is active, outlined (SAVED-11). */
  activeIds: ReadonlySet<string>;
  onActiveChange: (listingId: string | null) => void;
  /** The cars whose heart reads saved: every one on /favorites, the buyer's favorites on an alert's page. */
  savedIds: ReadonlySet<string>;
  /** The heart was pressed: a removal on /favorites, a toggle on an alert's page. */
  onToggleSaved: (listing: CarListing) => void;
  /** What a compact row writes after «año · km» (SAVED-19, ALERTUI-25). */
  rowTail?: RowTail;
  onOpen: (listing: CarListing, row: HTMLButtonElement) => void;
  /** A row took the focus, so the rows around it stay mounted (SAVED-28). */
  onRowFocus: (row: number) => void;
}

export function SavedList({
  listRef,
  virtualizer,
  scrollMargin,
  listings,
  columns,
  activeIds,
  onActiveChange,
  savedIds,
  onToggleSaved,
  rowTail = "city",
  onOpen,
  onRowFocus,
}: SavedListProps) {
  const isPhone = columns === 1;

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const cars = listings.slice(row.index * columns, (row.index + 1) * columns);

        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className={cn("absolute top-0 left-0 w-full", ROW_GRID[columns])}
            style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
          >
            {cars.map((listing) => (
              <div key={listing.id} className="min-w-0">
                <SavedItem
                  listing={listing}
                  isPhone={isPhone}
                  rowTail={rowTail}
                  active={activeIds.has(listing.id)}
                  onActiveChange={(active) => onActiveChange(active ? listing.id : null)}
                  saved={savedIds.has(listing.id)}
                  onToggleSaved={() => onToggleSaved(listing)}
                  onOpen={onOpen}
                  onFocus={() => onRowFocus(row.index)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
