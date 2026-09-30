import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { listFavorites } from "@/server/favorites/actions";

/**
 * The listing ids the signed-in user has saved.
 *
 * Search results and saved listings are fetched from completely different
 * places -- the sources return whatever matches the filters, with no idea what
 * this user saved -- so something has to reconcile them or every card renders
 * unsaved. That is what this does.
 *
 * Returns an empty set for signed-out visitors without calling the server:
 * there is nothing to fetch, and the action would only refuse.
 */
// Stable identity so a signed-out render does not hand consumers a new set
// every time.
const NO_FAVORITES: ReadonlySet<string> = new Set<string>();

export function useFavorites() {
  const { status } = useSession();
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function load() {
      const result = await listFavorites();
      if (cancelled || !result.success) return;
      setLoaded(new Set((result.data ?? []).map((listing) => listing.id)));
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Keeps the set in step with a toggle the user just made, so navigating away
  // and back does not show stale state while the refetch is in flight.
  const setFavorite = useCallback((listingId: string, saved: boolean) => {
    setLoaded((previous) => {
      const next = new Set(previous);
      if (saved) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  }, []);

  // Derived rather than cleared in the effect: signing out has to empty this
  // immediately, and clearing it from the effect would both lag by a render and
  // set state synchronously inside one.
  const favoriteIds = status === "authenticated" ? loaded : NO_FAVORITES;

  return { favoriteIds, setFavorite };
}
