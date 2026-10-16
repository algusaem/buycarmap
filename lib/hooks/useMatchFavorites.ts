import { useCallback } from "react";
import type { CarListing } from "@/interfaces/listing";
import { useCurrentPath } from "@/lib/hooks/useCurrentPath";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";

// docs/specs/redesign-alerts.md (ALERTUI-18, ALERTUI-19; worked example
// "Saved state", bug fix): the saved state of an alert's matches. An alert's
// match is a snapshot that knows nothing of the buyer's favorites, so it is
// reconciled with them exactly as /map reconciles its results
// (components/map/MapView.tsx): the saved ids from useFavorites, and the
// heart's own optimistic toggle (useFavoriteToggle), rolled back on failure.
// A press resolves to the failure's copy for the caller to toast, since a
// hook never toasts (FRONT-15).

export function useMatchFavorites() {
  const { favoriteIds, setFavorite } = useFavorites();
  const toggle = useFavoriteToggle();
  const callbackPath = useCurrentPath();

  /** Saves the listing (`next` true) or removes it; every control of that listing follows. */
  const toggleSaved = useCallback(
    (listing: CarListing, next: boolean): Promise<string | null> =>
      toggle({
        listing,
        next,
        callbackPath,
        apply: (saved) => setFavorite(listing.id, saved),
      }),
    [toggle, callbackPath, setFavorite],
  );

  return { favoriteIds, toggleSaved };
}
