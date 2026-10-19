"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { AnimatePresence, type HTMLMotionProps } from "motion/react";
import * as motion from "motion/react-client";
import { ArrowUpRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CarPhoto, HeartButton, listingMeta, savedProps } from "@/components/map/CarCard";
import type { CarListing } from "@/interfaces/listing";
import { crossFade } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";
import { formatPrice } from "@/lib/format";
import type { PinGroup } from "@/lib/map/group-pins";
import { cn } from "@/lib/utils";

export interface PreviewController {
  /**
   * Starts the exit animation instead of closing the preview outright.
   * PricePin's Escape, outside-press and toggle handlers call it, so every
   * close path — the button included — plays the same exit before PricePin
   * takes the popup off the map (MAPUI-27).
   */
  requestClose: () => void;
  /**
   * Cancels an exit in flight: PricePin calls it when its pin is activated
   * again mid-fade, so that press reopens the preview instead of closing it a
   * second time (MAPUI-27). It also bumps `openCount` (see below), so the
   * focus-on-open effect fires again and the card takes the focus back.
   */
  reset: () => void;
  /** Whether this preview is mid-exit (its fade is playing, its popup not yet
   * removed). PricePin's click handler reads this to tell a toggle-close from
   * a press that should cancel an in-flight close. */
  isClosing: () => boolean;
}

export interface PreviewProps {
  group: PinGroup;
  favoriteIds?: ReadonlySet<string>;
  onToggleFavorite?: (listing: CarListing, next: boolean) => void;
  /** Set, on mount, to this instance's open/close control (see `PreviewController`). */
  previewControlRef?: MutableRefObject<PreviewController | null>;
  /**
   * Called once this card's own exit animation finishes. PricePin removes
   * its own popup here, and only its own: another pin's preview may be
   * opening as this one leaves (MAPUI-27).
   */
  onExitComplete?: () => void;
}

// docs/specs/redesign-map.md (MAPUI-27); docs/design/system/components/MapPreview/README.md.
// The preview card a pin opens on desktop: the photo with the source badge
// and the close button, the name and city, «año · km · combustible», then the
// price with «Guardar» and «Ver anuncio» (new tab). A grouped pin lists its
// cars in price order, scrolling, and is named by its pin's label.
//
// PricePin (ListingsMap.tsx) mounts this card each time its preview opens,
// portaled with React's `createPortal` into the content element of a
// MapLibre `Popup` it adds to the map for as long as the preview is open,
// and unmounts it when the preview closes. The card fades in and takes the
// focus on its first control, the close button, as it mounts — and again
// when a press mid-fade cancels its exit (`reset`).
//
// It fades out too, when a person closes it: `closing` keeps the card mounted
// through its exit, and only once that exit completes does this call
// `onExitComplete` — PricePin's own close, which removes this pin's popup
// (never another pin's) and returns focus to the pin. Opened with Enter or Space on a
// pin, or closed with Escape, it appears and leaves at once instead: the fade
// is a pointer's only (MOTION-11). A close nobody triggered otherwise follows
// the last input, except a preview whose car leaves the results (below),
// which always goes at once.
//
// A car that leaves an open grouped preview (removed on /favorites, SAVED-14)
// leaves at once, with no fade, whatever the last input: it leaves with its
// pin, and pins never animate (MOTION-18). A car cannot come back into an open
// grouped preview — «Deshacer» sits outside it and closes it. The close
// button fills with `surface-strong` and «Ver anuncio» brightens on hover;
// both scale to 0.97 while pressed (MOTION-17).
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
  // Bumped by `reset()`, so the focus effect below reruns even when
  // `closing` was already `false` — a click on the pin mid-fade cancels the
  // exit (MAPUI-27).
  const [openCount, setOpenCount] = useState(0);
  const closingRef = useRef(false);
  closingRef.current = closing;

  // Runs on mount — every open — and every time `reset()` brings `closing`
  // back to false. `openCount` only has to change,
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
        <PreviewFrame
          key="preview"
          ref={previewRef}
          aria-label={group.listings.length > 1 ? group.label : t("map.preview")}
          className="flex max-h-120 flex-col gap-4 overflow-y-auto overscroll-contain p-3 font-sans text-text"
        >
          {group.listings.map((listing, index) => (
            <PreviewCar
              key={listing.id}
              listing={listing}
              {...savedProps(listing, favoriteIds, onToggleFavorite)}
              onClose={index === 0 ? () => setClosing(true) : undefined}
            />
          ))}
        </PreviewFrame>
      )}
    </AnimatePresence>
  );
}

/** The preview's own fade, instant from the keyboard (MOTION-11). */
function PreviewFrame(props: HTMLMotionProps<"article">) {
  const fade = usePresenceMotion(crossFade);

  return <motion.article {...fade} {...props} />;
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
    <div className="flex flex-col gap-2.5">
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
            className="absolute top-2.5 right-2.5 flex size-8 cursor-pointer items-center justify-center rounded-pill bg-scrim text-text transition-[background-color,scale] before:absolute before:size-11 hover:bg-surface-strong active:scale-97 motion-reduce:active:scale-none"
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
          className="flex h-10.5 items-center gap-1.5 whitespace-nowrap rounded-pill bg-lime px-4 text-sm font-extrabold text-on-lime! no-underline transition-[filter,scale] hover:brightness-108 active:scale-97 motion-reduce:active:scale-none"
        >
          {t("map.viewListing")}
          <ArrowUpRight aria-hidden="true" strokeWidth={2.4} className="size-4" />
        </a>
      </div>
    </div>
  );
}
