"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Heart, Car } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CarListing } from "@/interfaces/listing";
import { SourceBadge } from "@/components/map/SourceBadge";
import { useTranslation } from "@/lib/i18n/client";
import { removeFavorite, saveFavorite } from "@/app/actions/favorites";

interface CarListingCardProps extends CarListing {
  isFavorite?: boolean;
  onFavoriteChange?: (listingId: string, saved: boolean) => void;
}

export function CarListingCard({
  isFavorite = false,
  onFavoriteChange,
  ...listing
}: CarListingCardProps) {
  const {
    id,
    image,
    title,
    subtitle,
    price,
    mileage,
    year,
    fuel,
    location,
    source,
    url,
  } = listing;
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [favorite, setFavorite] = useState(isFavorite);
  const [imgError, setImgError] = useState(false);
  const showImage = image && !imgError;

  // The saved set arrives after the card has already mounted — search results
  // and saved listings come from different places and resolve at different
  // times — so seeding useState once would leave an already-saved car showing
  // as unsaved forever. Adjusting during render is React's documented way to
  // react to a changed prop; an effect here would render the wrong state first
  // and then correct it, which is a visible flicker on every search.
  const [syncedFavorite, setSyncedFavorite] = useState(isFavorite);
  if (syncedFavorite !== isFavorite) {
    setSyncedFavorite(isFavorite);
    setFavorite(isFavorite);
  }

  async function toggleFavorite() {
    // A signed-out visitor gets sent to sign in and back, rather than a
    // disabled control that would be a dead end or a hidden one they would
    // never discover. Pushed rather than rendered as a <Link> because the whole
    // card is already an anchor, and an anchor inside an anchor is invalid.
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    // Optimistic: favoriting is low-stakes and high-frequency, so the cost of
    // being briefly wrong is a heart that flickers back, while the cost of
    // waiting on a round trip is a control that feels broken.
    const next = !favorite;
    setFavorite(next);
    onFavoriteChange?.(id, next);

    try {
      const result = next
        ? await saveFavorite(listing)
        : await removeFavorite(id);
      if (!result.success) {
        setFavorite(!next);
        onFavoriteChange?.(id, !next);
        toast.error(t.map.favoriteFailed);
      }
    } catch {
      setFavorite(!next);
      onFavoriteChange?.(id, !next);
      toast.error(t.map.favoriteFailed);
    }
  }

  return (
    <article>
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        {/* Image container */}
        <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-card">
          {showImage ? (
            <Image
              src={image}
              alt={title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-card">
              <Car className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            className="absolute right-3 top-3 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-label={favorite ? t.map.removeFavorite : t.map.addFavorite}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                favorite
                  ? "fill-destructive text-destructive"
                  : "text-foreground",
              )}
            />
          </Button>

          {/* Source badge */}
          <SourceBadge source={source} className="absolute bottom-3 left-3" />
        </div>
      </Link>

      {/* Content */}
      <div className="mt-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-semibold text-foreground line-clamp-1">
            <Link
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              {title}
            </Link>
          </h3>
          <span className="shrink-0 font-mono text-base font-semibold text-primary">
            {price.toLocaleString("es-ES")}&nbsp;&euro;
          </span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-1">{subtitle}</p>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {year > 0 && <span>{year}</span>}
          {year > 0 && mileage > 0 && <span>&middot;</span>}
          {mileage > 0 && (
            <span className="font-mono">
              {mileage.toLocaleString("es-ES")}&nbsp;km
            </span>
          )}
          {(year > 0 || mileage > 0) && fuel && <span>&middot;</span>}
          {fuel && <span>{fuel}</span>}
        </div>

        <p className="text-sm text-muted-foreground">{location}</p>
      </div>
    </article>
  );
}
