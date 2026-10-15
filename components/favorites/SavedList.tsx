"use client";

import type { Virtualizer } from "@tanstack/react-virtual";
import type { Ref } from "react";
import { PresenceContext } from "motion/react";
import * as motion from "motion/react-client";
import { SavedCard } from "@/components/favorites/SavedCard";
import { SavedRow } from "@/components/favorites/SavedRow";
import type { CarListing } from "@/interfaces/listing";
import { crossFade } from "@/lib/animations";
import type { SavedColumns } from "@/lib/hooks/useSavedColumns";
import type { LeavingCar } from "@/lib/hooks/useSavedList";
import { cn } from "@/lib/utils";

// docs/specs/redesign-saved.md (SAVED-9, SAVED-14, SAVED-19, SAVED-25 to
// SAVED-29): the virtualised list (lib/hooks/useSavedList.ts) drawn as rows of
// Guardados cards on desktop, 20px apart, or as compact rows on the phone.
// Each row sits at the offset the virtualiser gives it and is measured once
// drawn; the rows are in the DOM in their order, so Tab walks the cars in
// order.
//
// A removed car fades out where it was, drawn once more over the list as a
// leaving entry: `inert`, `aria-hidden` and not one of `listings`. The cars
// after it move up under it at once, with no animation of their own, so a car
// that changes rows is never drawn in two of them, and a car that comes back
// (an undo) drops its leaving entry (lib/hooks/useSavedList.ts) and fades in
// where it lands, once: a car the virtualiser mounts later, while scrolling,
// is drawn at once.
//
// Both fades play as their element mounts. The list sits inside the page's
// `AnimatePresence initial={false}` (FavoritesList), whose presence tells
// every motion element under it to skip its first animation, so the list
// opens its own presence-free scope: without it a leaving car would vanish at
// once and never report its fade's end.

/** A row's grid by its column count: the phone's single compact row needs none. */
const ROW_GRID: Record<SavedColumns, string> = {
  1: "",
  2: "grid grid-cols-2 gap-x-5",
  3: "grid grid-cols-3 gap-x-5",
};

/** A leaving car's column in its row's grid. */
const COLUMN_START = ["col-start-1", "col-start-2", "col-start-3"];

function ignore() {
  // A leaving car is inert: nothing on it can be pressed, hovered or focused.
}

interface SavedItemProps {
  listing: CarListing;
  isPhone: boolean;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  onRemove: () => void;
  onOpen: (listing: CarListing, row: HTMLButtonElement) => void;
  onFocus: () => void;
}

/** A car as the list draws it: a compact row on the phone, a Guardados card on desktop. */
function SavedItem({
  listing,
  isPhone,
  active,
  onActiveChange,
  onRemove,
  onOpen,
  onFocus,
}: SavedItemProps) {
  return (
    <>
      {isPhone && <SavedRow listing={listing} onOpen={onOpen} onFocus={onFocus} />}
      {!isPhone && (
        <SavedCard
          listing={listing}
          active={active}
          onActiveChange={onActiveChange}
          onRemove={onRemove}
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
  onRemove: (listing: CarListing) => void;
  onOpen: (listing: CarListing, row: HTMLButtonElement) => void;
  /** A row took the focus, so the rows around it stay mounted (SAVED-28). */
  onRowFocus: (row: number) => void;
  /** The removed cars still fading out. */
  leaving: LeavingCar[];
  onLeft: (key: string) => void;
  /** The cars an undo just brought back, which fade in as they mount. */
  arriving: ReadonlySet<string>;
}

export function SavedList({
  listRef,
  virtualizer,
  scrollMargin,
  listings,
  columns,
  activeIds,
  onActiveChange,
  onRemove,
  onOpen,
  onRowFocus,
  leaving,
  onLeft,
  arriving,
}: SavedListProps) {
  const isPhone = columns === 1;

  return (
    <PresenceContext.Provider value={null}>
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
                <motion.div
                  key={listing.id}
                  initial={arriving.has(listing.id) ? crossFade.initial : false}
                  animate={crossFade.animate}
                  transition={crossFade.transition}
                  className="min-w-0"
                >
                  <SavedItem
                    listing={listing}
                    isPhone={isPhone}
                    active={activeIds.has(listing.id)}
                    onActiveChange={(active) => onActiveChange(active ? listing.id : null)}
                    onRemove={() => onRemove(listing)}
                    onOpen={onOpen}
                    onFocus={() => onRowFocus(row.index)}
                  />
                </motion.div>
              ))}
            </div>
          );
        })}
        {leaving.map((entry) => (
          <div
            key={entry.key}
            inert
            aria-hidden="true"
            data-leaving=""
            className={cn("pointer-events-none absolute top-0 left-0 w-full", ROW_GRID[columns])}
            style={{ transform: `translateY(${entry.top}px)` }}
          >
            <motion.div
              initial={crossFade.animate}
              animate={crossFade.exit}
              transition={crossFade.transition}
              onAnimationComplete={() => onLeft(entry.key)}
              className={cn("min-w-0", !isPhone && COLUMN_START[entry.column])}
            >
              <SavedItem
                listing={entry.listing}
                isPhone={isPhone}
                active={false}
                onActiveChange={ignore}
                onRemove={ignore}
                onOpen={ignore}
                onFocus={ignore}
              />
            </motion.div>
          </div>
        ))}
      </div>
    </PresenceContext.Provider>
  );
}
