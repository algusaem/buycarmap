"use client";

import { type DragEvent, type ReactNode, type Ref, useEffect, useId, useRef } from "react";
import * as motion from "motion/react-client";
import { BellPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CarCard, savedProps } from "@/components/map/CarCard";
import { RESULTS_GRID_CLASS } from "@/components/map/results-grid";
import { Button } from "@/components/ui/button";
import type { CarListing } from "@/interfaces/listing";
import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";
import { useResultsSheetDrag } from "@/lib/hooks/useResultsSheetDrag";
import { cardDomId } from "@/lib/map/card-dom-id";
import { nextPositionUp } from "@/lib/map/sheet-position";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-23, MAPUI-24, MAPUI-33, MAPUI-58, MAPUI-59);
// docs/design/system/components/BottomSheet/README.md. On a phone the results
// live in a sheet over the map, resting on the tab bar, in three positions:
// peeked shows the title (and «Crear alerta» under it), middle the first card,
// full the list, up to the top while the tab bar hides. The handle is a button
// that moves the sheet one position up on each press (peeked, middle, full,
// then peeked again), `aria-expanded` only when full. The sheet also drags
// from the handle strip and the title and, below full, from anywhere on it;
// at full never from the list (useResultsSheetDrag).
//
// From `lg` the same element is the list column beside the map (`docked`,
// MAPUI-65, MAPUI-66): half of the row MapResultsArea lays out, the 30px
// heading, 24px under the header band, then every card, whatever the
// position, two columns 24px apart with 40px between rows, three from 1920px
// (`4xl`); no handle or «Crear alerta» (the header has its own). The list's
// scroller reaches into the row's 48px left margin and halfway into the 48px
// gap before the map, and pads back to the cards: the active card's 2px lime
// outline is never clipped at the sides, its scrollbar sits 24px clear of the
// cards, and 6px over the first row (taken from the heading's gap) keep its
// top whole too — room enough for a focused card's outline.
//
// The phone map sits under the `surface` band across the top (MAPUI-67), and
// so does this sheet: the area it is laid out in is the map's, under the band.
// Once placed, the sheet is laid out as tall as that area, its lower edge
// behind the tab bar, and each position only translates it down, so a drag
// moves its top edge alone and no map shows under it (useResultsSheetDrag).
// Until then (the server render, the first client render) it keeps the
// resting layout of its position, so the server HTML already shows it. The
// middle position is 520px tall (BottomSheet README) but never taller than
// the room between the tab bar and 12px under the band. Full reaches the
// band.
//
// The list never animates (MOTION-8): the body, the switch between a results
// state and the cards, and the cards themselves appear and leave at once, at
// every position and in the desktop column.

export interface ResultsSheetProps {
  heading: string;
  position: ResultsSheetPosition;
  onPositionChange: (position: ResultsSheetPosition) => void;
  listings: CarListing[];
  onCreateAlert: () => void;
  /** The phone «Crear alerta» button, where focus returns when its sheet closes. */
  createAlertRef?: Ref<HTMLButtonElement>;
  /** At desktop width: the list column, showing every card whatever the position. */
  docked?: boolean;
  favoriteIds?: ReadonlySet<string>;
  onToggleFavorite?: (listing: CarListing, next: boolean) => void;
  /** The car whose pin is active (MAPUI-27, MAPUI-28). */
  activeId?: string | null;
  onActiveChange?: (listingId: string | null) => void;
  /** The loading, empty or error state, in place of the cards. */
  status?: ReactNode;
  /** Under the whole list (the infinite-scroll sentinel), never under the middle position's single card. */
  footer?: ReactNode;
  /**
   * Hears where the phone sheet's top edge rests at its position, in px from
   * the top of the area it shares with the map (null until measured, and
   * docked): what it covers leaves the tab order (A11Y-4).
   */
  onRestingTopChange?: (top: number | null) => void;
}

function visibleListings(listings: CarListing[], position: ResultsSheetPosition, docked: boolean) {
  if (docked || position === "full") return listings;
  if (position === "middle") return listings.slice(0, 1);
  return [];
}

/**
 * Where a pointerdown may start the sheet's drag: below full, anywhere on
 * the sheet itself; at full, only the header strip and the title.
 */
function pickDragStarters<T>(
  dragsFromAnywhere: boolean,
  startDrag: T | undefined,
): { sheetDrag: T | undefined; headerDrag: T | undefined } {
  if (dragsFromAnywhere) return { sheetDrag: startDrag, headerDrag: undefined };
  return { sheetDrag: undefined, headerDrag: startDrag };
}

/** A mouse pressing a card's link would drag the link itself, never the sheet. */
function preventNativeDrag(event: DragEvent) {
  event.preventDefault();
}

export function ResultsSheet({
  heading,
  position,
  onPositionChange,
  listings,
  onCreateAlert,
  createAlertRef,
  docked = false,
  favoriteIds,
  onToggleFavorite,
  activeId,
  onActiveChange,
  status,
  footer,
  onRestingTopChange,
}: ResultsSheetProps) {
  const t = useTranslations();
  const headingId = useId();
  const showBody = docked || position !== "peeked";
  const showsWholeList = docked || position === "full";
  const cards = visibleListings(listings, position, docked);
  const drag = useResultsSheetDrag({ position, onPositionChange, docked });
  const startDrag = docked ? undefined : drag.startDrag;
  // Below full the body has nothing to scroll, so the whole sheet drags; at
  // full the list keeps its scroll and only the strip and the title drag.
  const dragsFromAnywhere = !docked && position !== "full";
  const { sheetDrag, headerDrag: startHeaderDrag } = pickDragStarters(dragsFromAnywhere, startDrag);
  const restingTopChangeRef = useRef(onRestingTopChange);
  restingTopChangeRef.current = onRestingTopChange;
  useEffect(() => {
    restingTopChangeRef.current?.(drag.restingTop);
  }, [drag.restingTop]);

  return (
    <>
      <PositionProbes middleRef={drag.middleProbeRef} peekedRef={drag.peekedProbeRef} />
      <motion.section
        ref={drag.sheetRef}
        {...drag.dragProps}
        drag={docked ? false : "y"}
        onPointerDown={sheetDrag}
        onDragStartCapture={dragsFromAnywhere ? preventNativeDrag : undefined}
        aria-labelledby={headingId}
        data-testid="results-sheet"
        data-position={position}
        className={cn(
          // Phone: a `surface` sheet over the map. Placed, as tall as the
          // area and translated down to its position (useResultsSheetDrag);
          // before that, resting on the tab bar at its position's height.
          "absolute inset-x-0 z-1000 flex flex-col gap-3.5 rounded-t-sheet border-t border-line bg-surface px-5 pt-2.5",
          drag.placed && "top-0 bottom-0",
          !drag.placed && restingClasses(position),
          // While a finger moves it, no text is selected, and the list and «Crear alerta» take no input.
          drag.dragging && "select-none",
          // Below full a finger anywhere moves it, never the page.
          dragsFromAnywhere && "touch-none select-none",
          // Desktop: the list column beside the map.
          "lg:static lg:z-auto lg:h-full lg:min-w-0 lg:flex-1 lg:gap-4 lg:rounded-none lg:border-t-0 lg:bg-transparent lg:px-0 lg:pt-6 lg:pb-0",
        )}
      >
        {/* The handle, the title and «Crear alerta»: the peeked sheet's height, measured for the drag. */}
        <div ref={drag.headerRef} className="flex shrink-0 flex-col gap-3.5">
          {/* The handle strip: the whole row starts a drag, the button inside it is the handle. */}
          <div
            data-testid="results-sheet-handle-strip"
            onPointerDown={startHeaderDrag}
            className="-my-2.5 flex shrink-0 touch-none justify-center select-none lg:hidden"
          >
            <button
              type="button"
              aria-label={t("map.sheetHandle")}
              aria-expanded={position === "full"}
              // A click that ends a drag is not a press (MAPUI-59); a key press
              // never follows a drag.
              onKeyDown={() => drag.consumeDrag()}
              onClick={() => {
                if (drag.consumeDrag()) return;
                onPositionChange(nextPositionUp(position));
              }}
              className="flex h-11 w-16 cursor-pointer touch-none items-center justify-center select-none"
            >
              <span aria-hidden="true" className="h-1.25 w-10 rounded-pill bg-handle" />
            </button>
          </div>
          <h1
            id={headingId}
            onPointerDown={startHeaderDrag}
            className="shrink-0 touch-none text-center font-display text-count-mobile font-extrabold uppercase select-none lg:touch-auto lg:text-left lg:text-count lg:select-auto"
          >
            {heading}
          </h1>
          {/* While a finger moves the sheet it takes no input either; the strip and the title, which own the drag, stay live. */}
          <Button
            ref={createAlertRef}
            type="button"
            variant="secondary"
            size="44"
            inert={drag.dragging}
            onClick={onCreateAlert}
            className="w-full lg:hidden"
          >
            <BellPlus aria-hidden="true" strokeWidth={2.2} className="size-4.5" />
            {t("createAlert.open")}
          </Button>
        </div>
        {showBody && (
          <div
            inert={drag.dragging}
            className={cn(
              "min-h-0 flex-1 overscroll-contain lg:-mr-6 lg:-ml-12 lg:pt-1.5 lg:pr-6 lg:pl-12",
              // MAPUI-23: at full, clears the home indicator (and, once the
              // tab bar hides, the room it left) instead of the plain pb-6
              // the other positions and the desktop list column keep.
              position === "full" ? "pb-sheet-full-bottom" : "pb-6",
              showsWholeList ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            {status}
            {!status && (
              <div className={RESULTS_GRID_CLASS}>
                {cards.map((listing) => (
                  <CarCard
                    key={listing.id}
                    domId={cardDomId(listing.id)}
                    listing={listing}
                    {...savedProps(listing, favoriteIds, onToggleFavorite)}
                    active={activeId === listing.id}
                    onActiveChange={
                      onActiveChange
                        ? (active) => onActiveChange(active ? listing.id : null)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
            {showsWholeList && footer}
          </div>
        )}
      </motion.section>
    </>
  );
}

/** The phone sheet's layout before it is placed: resting on the tab bar, or reaching the top of the area under the band at full. */
function restingClasses(position: ResultsSheetPosition): string {
  if (position === "full") return "top-0 bottom-0";
  if (position === "middle") return "bottom-sheet-above-tabs h-sheet-middle";
  return "bottom-sheet-above-tabs pb-3.5";
}

interface PositionProbesProps {
  middleRef: Ref<HTMLDivElement>;
  peekedRef: Ref<HTMLDivElement>;
}

/**
 * Two empty, invisible boxes drawn with the sheet's own position classes,
 * so a drag measures where each position's top edge is (useResultsSheetDrag):
 * the middle sheet, and the peeked sheet's border and padding (its header is measured
 * on the sheet itself). Full's top is the area's own.
 */
function PositionProbes({ middleRef, peekedRef }: PositionProbesProps) {
  return (
    <>
      <div
        ref={middleRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 bottom-sheet-above-tabs h-sheet-middle lg:hidden"
      />
      <div
        ref={peekedRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 bottom-sheet-above-tabs border-t pt-2.5 pb-3.5 lg:hidden"
      />
    </>
  );
}
