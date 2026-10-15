import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import type { CarListing } from "@/interfaces/listing";
import { type SavedSort, savedSortParsers, sortSaved } from "@/lib/favorites/sort";
import { useCurrentPath } from "@/lib/hooks/useCurrentPath";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";

// docs/specs/redesign-saved.md (SAVED-5 to SAVED-8, SAVED-14 to SAVED-17):
// the saved cars' list state. It keeps the server's list, newest saved first,
// less the cars removed on this page, and derives the shown order from the
// sort in the URL, which the phone ignores (SAVED-8). Removing and undoing go
// through the heart's own toggle (useFavoriteToggle): optimistic, rolled back
// on failure, and resolving to the failure's copy for the caller to toast,
// since a hook never toasts (FRONT-15).

/** The sort as a chip writes it: a history entry each (SAVED-7). */
const sortParser = savedSortParsers.sort.withOptions({ history: "push" });

/** What a removal or an undo did at once, and how its request ended. */
interface SavedChange {
  /** Whether the list changed: false while the session is still resolving (FAV-18). */
  applied: boolean;
  /** The failure's copy once the server answers, or null when it succeeded or a later change superseded it. */
  failure: Promise<string | null>;
}

function withRemoved(removed: ReadonlySet<string>, id: string, isRemoved: boolean) {
  const next = new Set(removed);
  if (isRemoved) next.add(id);
  else next.delete(id);
  return next;
}

export function useSavedCars(favorites: CarListing[], isPhone: boolean) {
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useFavoriteToggle();
  const callbackPath = useCurrentPath();
  // Each car's latest change: an answer to an older one (a removal answered
  // after its undo) must not roll back the newer one, nor toast its failure.
  const versionsRef = useRef(new Map<string, number>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const shown = useMemo(
    () =>
      sortSaved(
        favorites.filter((listing) => !removedIds.has(listing.id)),
        isPhone ? "recent" : sort,
      ),
    [favorites, removedIds, isPhone, sort],
  );
  const savedIds = useMemo(() => new Set(shown.map((listing) => listing.id)), [shown]);

  const change = useCallback(
    (listing: CarListing, saved: boolean): SavedChange => {
      const version = (versionsRef.current.get(listing.id) ?? 0) + 1;
      versionsRef.current.set(listing.id, version);
      const isCurrent = () => mountedRef.current && versionsRef.current.get(listing.id) === version;
      let applied = false;

      // The toggle applies its optimistic state before its first await, so
      // `applied` is settled by the time this returns.
      const failure = (async () => {
        const message = await toggle({
          listing,
          next: saved,
          callbackPath,
          apply: (isSaved) => {
            if (!isCurrent()) return;
            applied = true;
            setRemovedIds((removed) => withRemoved(removed, listing.id, !isSaved));
          },
        });
        return isCurrent() ? message : null;
      })();

      return { applied, failure };
    },
    [toggle, callbackPath],
  );

  return {
    /** The sort in force from the URL; the phone shows «Recientes» whatever it says. */
    sort,
    setSort: (next: SavedSort) => void setSort(next),
    /** The saved cars still on the page, in the order shown. */
    shown,
    savedIds,
    remove: (listing: CarListing) => change(listing, false),
    undo: (listing: CarListing) => change(listing, true),
  };
}
