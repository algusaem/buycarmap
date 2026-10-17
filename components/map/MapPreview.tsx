"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { ArrowUpRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CarPhoto, HeartButton, listingMeta, savedProps } from "@/components/map/CarCard";
import type { CarListing } from "@/interfaces/listing";
import { crossFade } from "@/lib/animations";
import { formatPrice } from "@/lib/format";
import type { PinGroup } from "@/lib/map/group-pins";
import { cn } from "@/lib/utils";

export interface PreviewController {
  /**
   * Starts the exit animation instead of closing the popup outright.
   * PricePin's Escape and outside-press handlers call it in place of
   * `event.popup.close()` / `marker.closePopup()`, so every close path —
   * the button included — plays the same fade-out before `map.closePopup()`
   * actually tears the popup down (MAPUI-27).
   */
  requestClose: () => void;
  /**
   * Called from PricePin's `popupopen` handler, on every open including a
   * reopen. react-leaflet's div-overlay (`@react-leaflet/core`'s
   * `createDivOverlayComponent`) portals `children` into the popup's own
   * content node for as long as that node exists, open or closed — Leaflet
   * detaches the node from the map rather than React ever unmounting this
   * component, so without this, `closing` would stay true from the previous
   * close and a reopened popup would show nothing. Also bumps `openCount` (see
   * below), so the focus-on-open effect fires again even when `closing` was
   * already `false` — a click on the pin mid-fade cancels the exit instead of
   * closing it a second time (MAPUI-27).
   */
  reset: () => void;
  /** Whether this preview is mid-exit (its fade is playing, the real Leaflet
   * popup not yet closed). PricePin's click handler reads this to tell a
   * toggle-close from a click that should cancel an in-flight close. */
  isClosing: () => boolean;
}

export interface PreviewProps {
  group: PinGroup;
  favoriteIds?: ReadonlySet<string>;
  onToggleFavorite?: (listing: CarListing, next: boolean) => void;
  /** Set, on mount, to this instance's open/close control (see `PreviewController`). */
  previewControlRef?: MutableRefObject<PreviewController | null>;
  /**
   * Called once this card's own exit animation finishes. PricePin closes
   * only its own marker's popup here — never a bare `map.closePopup()`,
   * which would risk tearing down whichever popup Leaflet last opened
   * instead of this one (MAPUI-27).
   */
  onExitComplete?: () => void;
}

// docs/specs/redesign-map.md (MAPUI-27); docs/design/system/components/MapPreview/README.md.
// The preview card a pin opens on desktop: the photo with the source badge
// and the close button, the name and city, «año · km · combustible», then the
// price with «Guardar» and «Ver anuncio» (new tab). A grouped pin lists its
// cars in price order, scrolling, and is named by its pin's label. It fades
// in (Leaflet's own popup fade is off, see ListingsMap) and takes the focus
// on its first control, the close button — on every open, a reopen included,
// since the underlying React tree is never actually remounted (`reset`).
//
// It fades out too, however it closes: `closing` keeps the card mounted
// through its exit, and only once that exit completes does this call
// `onExitComplete` — PricePin's own `marker.closePopup()` (ListingsMap.tsx),
// never a bare `map.closePopup()` that could close a different pin's popup —
// which then tears the (real) Leaflet popup down and lets the existing
// popupclose handler return focus to the pin.
//
// A car that leaves an open grouped preview (removed on /favorites, SAVED-14)
// fades out on its own, and one that comes back (an undo) fades in; the cars
// there when the preview opens are drawn at once, so /map's preview is as it
// was.
export function MapPreview({
  group,
  favoriteIds,
  onToggleFavorite,
  previewControlRef,
  onExitComplete,
}: PreviewProps) {
  const t = useTranslations();
  const previewRef = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  // Bumped by `reset()` on every open, a reopen included, so the focus
  // effect below reruns even when `closing` was already `false` — a click
  // on the pin mid-fade cancels the exit (MAPUI-27).
  const [openCount, setOpenCount] = useState(0);
  const closingRef = useRef(false);
  closingRef.current = closing;

  // Runs on mount and every time `reset()` brings `closing` back to false —
  // i.e. on every open, a reopen included. `openCount` only has to change,
  // not be read, to force that rerun when `closing` was already `false`
  // (reopening mid-fade); referencing it keeps the lint rule that enforces
  // the dependency list from the deliberate list to the otherwise-flagged
  // "unused" one.
  useEffect(() => {
    if (closing) return;
    void openCount;
    previewRef.current
      ?.querySelector<HTMLElement>("button, a[href]")
      ?.focus({ preventScroll: true });
  }, [closing, openCount]);

  useEffect(() => {
    if (!previewControlRef) return;
    previewControlRef.current = {
      requestClose: () => setClosing(true),
      reset: () => {
        setClosing(false);
        setOpenCount((count) => count + 1);
      },
      isClosing: () => closingRef.current,
    };
    return () => {
      previewControlRef.current = null;
    };
  }, [previewControlRef]);

  return (
    <AnimatePresence onExitComplete={() => closing && onExitComplete?.()}>
      {!closing && (
        <motion.article
          key="preview"
          ref={previewRef}
          {...crossFade}
          aria-label={group.listings.length > 1 ? group.label : t("map.preview")}
          className="flex max-h-120 flex-col gap-4 overflow-y-auto overscroll-contain p-3 font-sans text-text"
        >
          <AnimatePresence initial={false}>
            {group.listings.map((listing, index) => (
              <PreviewCar
                key={listing.id}
                listing={listing}
                {...savedProps(listing, favoriteIds, onToggleFavorite)}
                onClose={index === 0 ? () => setClosing(true) : undefined}
              />
            ))}
          </AnimatePresence>
        </motion.article>
      )}
    </AnimatePresence>
  );
}

interface PreviewCarProps {
  listing: CarListing;
  saved: boolean;
  onToggleSaved?: () => void;
  /** Only the first car carries the close button. */
  onClose?: () => void;
}

function PreviewCar({ listing, saved, onToggleSaved, onClose }: PreviewCarProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <motion.div {...crossFade} className="flex flex-col gap-2.5">
      <div className="relative">
        <CarPhoto
          listing={listing}
          alt={listing.title}
          sizes="340px"
          className="h-42.5 rounded-field"
        />
        {onClose && (
          <button
            type="button"
            aria-label={t("map.closePreview")}
            onClick={onClose}
            className="absolute top-2.5 right-2.5 flex size-8 cursor-pointer items-center justify-center rounded-pill bg-scrim text-text before:absolute before:size-11"
          >
            <X aria-hidden="true" strokeWidth={2.4} className="size-4" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <strong className="min-w-0 truncate text-base font-bold">{listing.title}</strong>
        <span className="min-w-0 max-w-2/5 truncate text-small text-text-muted">
          {listing.location}
        </span>
      </div>
      <span className="-mt-1.5 text-sm text-text-muted">{listingMeta(listing, { t, locale })}</span>
      <div className="flex items-center gap-2">
        <strong className="flex-1 whitespace-nowrap font-display text-2xl font-extrabold text-lime tabular-nums">
          {formatPrice(listing.price, locale)}
        </strong>
        <HeartButton
          saved={saved}
          onToggle={onToggleSaved}
          className={cn("size-10.5", !saved && "border border-line bg-transparent")}
        />
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10.5 items-center gap-1.5 whitespace-nowrap rounded-pill bg-lime px-4 text-sm font-extrabold text-on-lime! no-underline"
        >
          {t("map.viewListing")}
          <ArrowUpRight aria-hidden="true" strokeWidth={2.4} className="size-4" />
        </a>
      </div>
    </motion.div>
  );
}
