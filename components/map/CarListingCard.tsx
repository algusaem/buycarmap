"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CarListing } from "@/interfaces/listing";
import { CarCard } from "@/components/map/CarCard";
import { useCurrentPath } from "@/lib/hooks/useCurrentPath";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";

interface CarListingCardProps extends CarListing {
  isFavorite?: boolean;
  onFavoriteChange?: (listingId: string, saved: boolean) => void;
  /** Only set for an alert's matches — when the card was discovered, not when the listing was published (no source exposes that). */
  foundAt?: Date;
}

/**
 * The car card with its own saved state (FAV-9 to FAV-12, FAV-16), for
 * /favorites and an alert's matches (MAPUI-38). The map renders the same
 * CarCard with the saved state its page already holds.
 */
export function CarListingCard({
  isFavorite = false,
  onFavoriteChange,
  foundAt,
  ...listing
}: CarListingCardProps) {
  const currentPath = useCurrentPath();
  const toggleFavorite = useFavoriteToggle();
  const [favorite, setFavorite] = useState(isFavorite);

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

  async function handleToggle() {
    const failure = await toggleFavorite({
      listing,
      next: !favorite,
      apply: (saved) => {
        setFavorite(saved);
        onFavoriteChange?.(listing.id, saved);
      },
      // MAPUI-37: the full path and query, so the search survives the sign-in.
      callbackPath: currentPath,
    });
    if (failure) toast.error(failure);
  }

  return (
    <CarCard listing={listing} saved={favorite} onToggleSaved={handleToggle} foundAt={foundAt} />
  );
}
