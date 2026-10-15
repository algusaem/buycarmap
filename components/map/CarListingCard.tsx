"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CarListing } from "@/interfaces/listing";
import { CarCard } from "@/components/map/CarCard";
import { useCurrentPath } from "@/lib/hooks/useCurrentPath";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";

interface CarListingCardProps extends CarListing {
  onFavoriteChange?: (listingId: string, saved: boolean) => void;
  /** Only set for an alert's matches — when the card was discovered, not when the listing was published (no source exposes that). */
  foundAt?: Date;
}

/**
 * The car card with its own saved state (FAV-10 to FAV-12), for an alert's
 * matches (MAPUI-38), which start unsaved. The map renders the same CarCard
 * with the saved state its page already holds.
 */
export function CarListingCard({ onFavoriteChange, foundAt, ...listing }: CarListingCardProps) {
  const currentPath = useCurrentPath();
  const toggleFavorite = useFavoriteToggle();
  const [favorite, setFavorite] = useState(false);

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
