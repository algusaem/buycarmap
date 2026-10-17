"use client";

import type { RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, Heart, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CarMeta, CarName, CarNameRow, CarPhoto } from "@/components/map/CarCard";
import { PhoneBottomSheet } from "@/components/map/phone/SheetChrome";
import { Button } from "@/components/ui/button";
import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

// docs/specs/redesign-saved.md (SAVED-20 to SAVED-23);
// docs/design/system/components/BottomSheet/README.md › Hoja del coche and
// F5-guardados-coche: what a compact row opens on the phone. A modal bottom
// sheet named by the car, with the handle on top (dragged down, it closes the
// sheet; «Cerrar» is visually hidden, SAVED-37 to SAVED-41), the 200px
// photo with its badge, the name and city, «año · km · combustible», the
// price, then «Quitar de guardados» and «Ver anuncio» (new tab), 48px each.
// An alert's match opens the same sheet (docs/specs/redesign-alerts.md,
// ALERTUI-26), whose button reads the buyer's favorites: «Guardar», or
// «Quitar de guardados» drawn saved (ALERTUI-18).

interface SavedCarSheetProps {
  /** The car shown, kept while the sheet plays its exit. */
  listing: CarListing | null;
  open: boolean;
  onClose: () => void;
  /** Whether the car is saved: «Quitar de guardados» with the violet heart, or «Guardar». */
  saved: boolean;
  onToggleSaved: (listing: CarListing) => void;
  /** The row that opened it, or after a removal the item that takes the focus (SAVED-18, SAVED-21). */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function SavedCarSheet({
  listing,
  open,
  onClose,
  saved,
  onToggleSaved,
  returnFocusRef,
}: SavedCarSheetProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <PhoneBottomSheet
      open={open && listing !== null}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      overlayClassName="bg-bg/72"
      className="gap-3.5 px-5 pb-sheet-bottom"
      entrance="slide"
    >
      {/* «Cerrar» for screen readers and the keyboard: visually hidden, it
          shows at the top right, where the design used to draw the «×», only
          with keyboard focus (SAVED-41). */}
      <span className="absolute top-2.5 right-5 z-20">
        <Button
          type="button"
          variant="icon"
          size="icon-40"
          aria-label={t("common.close")}
          onClick={onClose}
          className="sr-only not-focus-visible:size-px focus-visible:not-sr-only focus-visible:size-10"
        >
          <X aria-hidden="true" strokeWidth={2.6} className="size-3.5" />
        </Button>
      </span>
      {listing && (
        <>
          <CarPhoto
            listing={listing}
            alt=""
            sizes="100vw"
            iconClassName="size-17.5"
            className="h-50 shrink-0 rounded-card"
          />
          <CarNameRow
            listing={listing}
            className="gap-3"
            name={
              <DialogPrimitive.Title asChild>
                <CarName title={listing.title} />
              </DialogPrimitive.Title>
            }
          />
          <CarMeta listing={listing} className="-mt-2.5" />
          <strong className="font-display text-price font-extrabold text-lime tabular-nums">
            {formatPrice(listing.price, locale)}
          </strong>
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="48"
              className="w-full"
              onClick={() => onToggleSaved(listing)}
            >
              <Heart
                aria-hidden="true"
                strokeWidth={2}
                className={cn("size-4", saved && "fill-violet text-violet")}
              />
              {saved ? t("map.removeFavorite") : t("map.addFavorite")}
            </Button>
            <Button asChild variant="primary" size="48" className="w-full gap-1.5">
              <a href={listing.url} target="_blank" rel="noopener noreferrer">
                {t("map.viewListing")}
                <ArrowUpRight aria-hidden="true" strokeWidth={2.6} className="size-3.75" />
              </a>
            </Button>
          </div>
        </>
      )}
    </PhoneBottomSheet>
  );
}
