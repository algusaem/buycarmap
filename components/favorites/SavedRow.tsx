"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CarPhoto, listingMeta, type MetaTail } from "@/components/map/CarCard";
import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import { cardDomId } from "@/lib/map/card-dom-id";

// docs/specs/redesign-saved.md (SAVED-19); docs/design/system/components/
// ListingCard/README.md › Fila compacta and R3-favoritos at 390: one button
// that opens the car sheet, with the 110×86 thumbnail (no badge, no heart),
// the name, «año · km · ciudad» and the price. It is named by the car and its
// price, and described by «año · km · ciudad»: the name stays short, and it
// never reads as the desktop sort chips («Km», «Precio»). An alert's match
// drops the city: «año · km» (docs/specs/redesign-alerts.md, ALERTUI-25).

/** What a compact row writes after «año · km»: the city on /favorites, nothing on an alert's page. */
export type RowTail = Exclude<MetaTail, "fuel">;

interface SavedRowProps {
  listing: CarListing;
  tail: RowTail;
  onOpen: (listing: CarListing, row: HTMLButtonElement) => void;
  /** The row took the focus (lib/hooks/useSavedList.ts keeps its neighbours mounted). */
  onFocus: () => void;
}

export function SavedRow({ listing, tail, onOpen, onFocus }: SavedRowProps) {
  const t = useTranslations();
  const locale = useLocale();
  const meta = listingMeta(listing, { t, locale }, tail);
  const id = useId();

  return (
    <button
      id={cardDomId(listing.id)}
      type="button"
      aria-haspopup="dialog"
      aria-labelledby={`${id}-title ${id}-price`}
      aria-describedby={meta !== "" ? `${id}-meta` : undefined}
      onClick={(event) => onOpen(listing, event.currentTarget)}
      onFocus={onFocus}
      className="flex w-full min-w-0 cursor-pointer items-center gap-3.5 rounded-thumb text-left hover:bg-surface active:bg-surface"
    >
      <CarPhoto
        listing={listing}
        alt=""
        sizes="110px"
        badge={false}
        iconClassName="size-9"
        className="h-21.5 w-27.5 shrink-0 rounded-thumb"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong id={`${id}-title`} className="truncate text-body-15 font-bold text-text">
          {listing.title}
        </strong>
        {meta !== "" && (
          <span id={`${id}-meta`} className="truncate text-small text-text-muted tabular-nums">
            {meta}
          </span>
        )}
        <span
          id={`${id}-price`}
          className="mt-1 font-display text-lg font-extrabold text-lime tabular-nums"
        >
          {formatPrice(listing.price, locale)}
        </span>
      </span>
    </button>
  );
}
