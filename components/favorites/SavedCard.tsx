"use client";

import type { FocusEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  activeHandlers,
  CarMeta,
  CarNameRow,
  CarPhoto,
  HeartButton,
} from "@/components/map/CarCard";
import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import { cardDomId } from "@/lib/map/card-dom-id";
import { cn } from "@/lib/utils";

// docs/specs/redesign-saved.md (SAVED-9 to SAVED-11, SAVED-28);
// docs/design/system/components/ListingCard/README.md and R3-favoritos: the
// Guardados card. The map card's photo, badge, heart, name row and meta line
// (components/map/CarCard.tsx), at 20:17, with «año · km» rather than the
// fuel, and «Ver anuncio» beside the price, inside the card's one link to the
// listing in a new tab. The heart, outside that link, removes the car.

interface SavedCardProps {
  listing: CarListing;
  /** Outlined while its pin is open or hovered (SAVED-11). */
  active: boolean;
  /** Hovering or focusing the card marks its pin (MAPUI-28). */
  onActiveChange: (active: boolean) => void;
  onRemove: () => void;
  /** The card took the focus (lib/hooks/useSavedList.ts keeps its neighbours mounted). */
  onFocus: () => void;
}

/**
 * Focusing a card's link or heart from the keyboard brings the whole card into
 * the list's view, so the virtualised list mounts the next one before Tab
 * reaches it (SAVED-28). Not on a pointer press: moving the card between the
 * press and the release would lose the click.
 */
function revealCard(event: FocusEvent<HTMLElement>) {
  if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
  event.currentTarget.scrollIntoView({ block: "nearest" });
}

export function SavedCard({ listing, active, onActiveChange, onRemove, onFocus }: SavedCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const marksPin = activeHandlers(onActiveChange);

  return (
    <article
      id={cardDomId(listing.id)}
      data-active={active || undefined}
      {...marksPin}
      onFocus={(event) => {
        marksPin.onFocus?.();
        onFocus();
        revealCard(event);
      }}
      className="relative min-w-0"
    >
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-3 rounded-card"
      >
        <CarPhoto
          listing={listing}
          alt=""
          sizes="(min-width: 1280px) 242px, 231px"
          iconClassName="size-14"
          className={cn(
            "aspect-20/17 rounded-card transition-[box-shadow]",
            active && "ring-2 ring-lime",
          )}
        />
        <span className="flex min-w-0 flex-col gap-0.75">
          <CarNameRow listing={listing} />
          <CarMeta listing={listing} tail="none" />
          <span className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-price font-extrabold text-lime tabular-nums">
              {formatPrice(listing.price, locale)}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold text-text underline">
              {t("map.viewListing")}
              <ArrowUpRight aria-hidden="true" strokeWidth={2.6} className="size-3.75" />
            </span>
          </span>
        </span>
      </a>
      <HeartButton saved onToggle={onRemove} className="absolute top-2.5 right-2.5" />
    </article>
  );
}
