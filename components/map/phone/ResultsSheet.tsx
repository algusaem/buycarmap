"use client";

import { type ReactNode, type Ref, useId } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { BellPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CarCard, savedProps } from "@/components/map/CarCard";
import { Button } from "@/components/ui/button";
import type { CarListing } from "@/interfaces/listing";
import { crossFade } from "@/lib/animations";
import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";
import { cardDomId } from "@/lib/map/card-dom-id";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-23, MAPUI-24, MAPUI-33);
// docs/design/system/components/BottomSheet/README.md. On a phone the results
// live in a sheet over the map, resting on the tab bar, in three positions:
// peeked shows the title (and «Crear alerta» under it), middle the first card,
// full the list, up to the top while the tab bar hides. The handle is a button
// that toggles between full and peeked, `aria-expanded` only when full.
//
// From `lg` the same element is the list column beside the map (`docked`):
// the results heading at 30px over every card, whatever the position, and no
// handle or «Crear alerta» (the header has its own).
//
// The middle position is 520px tall (BottomSheet README) but never taller than
// the room under the floating search (MAPUI-20): that search ends 130px below
// the safe area's top (20px offset, the 58px summary row, 10px gap, the 42px
// filters row), and the sheet keeps 12px clear of it, so on a 667px-tall
// phone the middle sheet is 461px. Full reaches the top, its content clear
// of the notch.

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
}

/**
 * What the body shows, the key its cross-fade swaps on: the state in place of
 * the cards, the first card (middle) or the whole list (full, or docked).
 */
function bodyKey(hasStatus: boolean, showsWholeList: boolean): string {
  if (hasStatus) return "status";
  return showsWholeList ? "list" : "first-card";
}

function visibleListings(listings: CarListing[], position: ResultsSheetPosition, docked: boolean) {
  if (docked || position === "full") return listings;
  if (position === "middle") return listings.slice(0, 1);
  return [];
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
}: ResultsSheetProps) {
  const t = useTranslations();
  const headingId = useId();
  const showBody = docked || position !== "peeked";
  const showsWholeList = docked || position === "full";
  const cards = visibleListings(listings, position, docked);

  return (
    <section
      aria-labelledby={headingId}
      data-testid="results-sheet"
      data-position={position}
      className={cn(
        // Phone: a `surface` sheet over the map, resting on the tab bar.
        "absolute inset-x-0 z-1000 flex flex-col gap-3.5 rounded-t-sheet border-t border-line bg-surface px-5 pt-2.5",
        position === "full" ? "top-0 bottom-0 pt-sheet-full-top" : "bottom-sheet-above-tabs",
        position === "middle" && "h-sheet-middle",
        position === "peeked" && "pb-3.5",
        // Desktop: the list column beside the map.
        "lg:static lg:z-auto lg:h-full lg:w-1/2 lg:shrink-0 lg:gap-5.5 lg:rounded-none lg:border-t-0 lg:bg-transparent lg:px-8 lg:pt-6.5 lg:pb-0 xl:w-207.5",
      )}
    >
      <button
        type="button"
        aria-label={t("map.sheetHandle")}
        aria-expanded={position === "full"}
        onClick={() => onPositionChange(position === "full" ? "peeked" : "full")}
        className="-my-2.5 flex h-11 w-16 shrink-0 cursor-pointer items-center justify-center self-center lg:hidden"
      >
        <span aria-hidden="true" className="h-1.25 w-10 rounded-pill bg-handle" />
      </button>
      <h1
        id={headingId}
        className="shrink-0 text-center font-display text-count-mobile font-extrabold uppercase lg:text-left lg:text-count"
      >
        {heading}
      </h1>
      <Button
        ref={createAlertRef}
        type="button"
        variant="secondary"
        size="44"
        onClick={onCreateAlert}
        className="w-full lg:hidden"
      >
        <BellPlus aria-hidden="true" strokeWidth={2.2} className="size-4.5" />
        {t("createAlert.open")}
      </Button>
      <AnimatePresence initial={false}>
        {showBody && (
          <motion.div
            key="body"
            {...crossFade}
            className={cn(
              "min-h-0 flex-1 overscroll-contain",
              // MAPUI-23: at full, clears the home indicator (and, once the
              // tab bar hides, the room it left) instead of the plain pb-6
              // the other positions and the desktop list column keep.
              position === "full" ? "pb-sheet-full-bottom" : "pb-6",
              showsWholeList ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            {/* The state and the cards, and the first card and the whole list, cross-fade one after the other. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={bodyKey(Boolean(status), showsWholeList)} {...crossFade}>
                {status}
                {!status && (
                  <div className="grid grid-cols-1 gap-x-5 gap-y-7 lg:grid-cols-2 xl:grid-cols-3">
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
              </motion.div>
            </AnimatePresence>
            {showsWholeList && footer}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
