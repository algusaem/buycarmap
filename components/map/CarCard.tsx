"use client";

import { useState } from "react";
import Image from "next/image";
import { Car, Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CarListing } from "@/interfaces/listing";
import { SourceBadge } from "@/components/map/SourceBadge";
import { formatMileage, formatPrice, formatRelativeTime } from "@/lib/format";
import type { LocaleCopy } from "@/lib/i18n/copy";
import { classifyFuel } from "@/lib/search/fuel-groups";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-35 to MAPUI-38);
// docs/design/system/components/ListingCard/README.md. The car card the map's
// list and results sheet, /favorites and an alert's matches all render: the
// photo (or the car's tint with the car icon), the source badge and the heart
// over it, the name with the city beside it, «año · km · combustible» and the
// price. The whole card is one link to the listing in a new tab; the heart is
// a separate button outside that link. It holds no saved state of its own:
// CarListingCard and the map pass it in.

// One tint per car, from photo-tint-1 to photo-tint-8, picked by its id so the
// same car keeps its tint across renders.
const TINTS = [
  "bg-photo-tint-1",
  "bg-photo-tint-2",
  "bg-photo-tint-3",
  "bg-photo-tint-4",
  "bg-photo-tint-5",
  "bg-photo-tint-6",
  "bg-photo-tint-7",
  "bg-photo-tint-8",
];

function tintFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % TINTS.length;
  return TINTS[hash];
}

// MAPUI-35: a listing's raw `fuel` field is each source's own display word,
// not our label — Wallapop sends English ("Gasoline", "Diesel"), coches.net
// and Milanuncios Spanish ("Diésel", "híbrido"). classifyFuel recognises them
// all and resolves to the shared `filters.fuelGroups.*` label; a fuel it does
// not recognise is left off.
function fuelLabel(fuel: string, t: LocaleCopy["t"]): string {
  const group = classifyFuel(fuel);
  return group ? t(`filters.fuelGroups.${group}`) : "";
}

/** «año · km · combustible», each part only when the listing has it. */
export function listingMeta(listing: CarListing, { t, locale }: LocaleCopy): string {
  const parts = [
    listing.year > 0 ? String(listing.year) : "",
    listing.mileage > 0 ? formatMileage(listing.mileage, locale) : "",
    fuelLabel(listing.fuel, t),
  ];
  return parts.filter((part) => part !== "").join(" · ");
}

interface CarPhotoProps {
  listing: CarListing;
  /** The photo's text alternative: empty where the car's name is already the surrounding link's text. */
  alt: string;
  sizes: string;
  className?: string;
}

/** The listing's photo, or its tint with the car icon when it has none or it fails to load. */
export function CarPhoto({ listing, alt, sizes, className }: CarPhotoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = listing.image !== "" && !failed;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        tintFor(listing.id),
        className,
      )}
    >
      {showImage && (
        <Image
          src={listing.image}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {!showImage && (
        <Car aria-hidden="true" strokeWidth={1.1} className="size-15 text-photo-icon" />
      )}
      <SourceBadge source={listing.source} className="absolute top-3 left-3" />
    </div>
  );
}

interface HeartButtonProps {
  saved: boolean;
  onToggle?: () => void;
  className?: string;
}

/**
 * A card's saved state and heart wiring from the page's favourites: the map's
 * list, its results sheet and its preview card all toggle the same way.
 */
export function savedProps(
  listing: CarListing,
  favoriteIds: ReadonlySet<string> | undefined,
  onToggleFavorite: ((listing: CarListing, next: boolean) => void) | undefined,
): Pick<CarCardProps, "saved" | "onToggleSaved"> {
  const saved = favoriteIds?.has(listing.id) ?? false;
  if (!onToggleFavorite) return { saved };
  return { saved, onToggleSaved: () => onToggleFavorite(listing, !saved) };
}

/** «Guardar» / «Quitar de guardados» (MAPUI-36): scrim when not saved, violet and filled once saved. */
export function HeartButton({ saved, onToggle, className }: HeartButtonProps) {
  const t = useTranslations();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={saved ? t("map.removeFavorite") : t("map.addFavorite")}
      className={cn(
        "flex size-8.5 cursor-pointer items-center justify-center rounded-pill transition-[background-color] before:absolute before:size-11",
        saved ? "bg-violet text-on-violet" : "bg-scrim text-text",
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        strokeWidth={2.2}
        className={cn("size-4", saved && "fill-on-violet")}
      />
    </button>
  );
}

export interface CarCardProps {
  listing: CarListing;
  saved: boolean;
  onToggleSaved?: () => void;
  /** Outlined while its pin is open or hovered on the map (MAPUI-27, MAPUI-28). */
  active?: boolean;
  /** Hovering or focusing the card marks its pin (MAPUI-28). */
  onActiveChange?: (active: boolean) => void;
  /** Only set for an alert's matches — when the card was discovered, not when the listing was published (no source exposes that). */
  foundAt?: Date;
  domId?: string;
}

export function CarCard({
  listing,
  saved,
  onToggleSaved,
  active = false,
  onActiveChange,
  foundAt,
  domId,
}: CarCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const meta = listingMeta(listing, { t, locale });
  const tracksActive = onActiveChange !== undefined;

  return (
    <article
      id={domId}
      data-active={active || undefined}
      // Focusable from script only, so focusing its link (which bubbles here)
      // and a programmatic focus both mark the pin, without a second tab stop.
      tabIndex={tracksActive ? -1 : undefined}
      onMouseEnter={tracksActive ? () => onActiveChange(true) : undefined}
      onMouseLeave={tracksActive ? () => onActiveChange(false) : undefined}
      onFocus={tracksActive ? () => onActiveChange(true) : undefined}
      onBlur={tracksActive ? () => onActiveChange(false) : undefined}
      className="relative scroll-mt-4 outline-none"
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
          sizes="(min-width: 1024px) 16vw, 100vw"
          className={cn(
            // 250px in the phone sheet, 20:19 in the desktop grid (BottomSheet and ListingCard READMEs).
            "h-62.5 rounded-card transition-[box-shadow] lg:aspect-20/19 lg:h-auto",
            active && "ring-2 ring-lime",
          )}
        />
        <span className="flex min-w-0 flex-col gap-0.75">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <strong className="min-w-0 truncate text-base font-bold text-text">
              {listing.title}
            </strong>
            {/* The city truncates too, and never takes more than two fifths of the row. */}
            <span className="min-w-0 max-w-2/5 truncate text-sm text-text-muted">
              {listing.location}
            </span>
          </span>
          {meta !== "" && <span className="truncate text-sm text-text-muted">{meta}</span>}
          <span className="mt-1.5 font-display text-price font-extrabold text-lime tabular-nums">
            {formatPrice(listing.price, locale)}
          </span>
          {foundAt && (
            <span className="text-xs text-text-muted">
              {t("alerts.foundAt", { time: formatRelativeTime(foundAt, locale) })}
            </span>
          )}
        </span>
      </a>
      <HeartButton saved={saved} onToggle={onToggleSaved} className="absolute top-2.5 right-2.5" />
    </article>
  );
}
