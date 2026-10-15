import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CarListing } from "@/interfaces/listing";
import { groupPins, type PinGroup } from "@/lib/map/group-pins";

// docs/specs/redesign-saved.md (SAVED-11, SAVED-12, SAVED-14): which pin of
// the saved map is active, and which cards are outlined. A pin is tracked by
// its point (the group's key), not by its first car, so a grouped preview
// stays open, and its cards outlined, when that car is removed from it.

/** No car: the empty set the saved page's hooks share, so an unchanged empty state keeps its identity. */
export const NO_IDS: ReadonlySet<string> = new Set();

function idsOf(group: PinGroup | undefined): ReadonlySet<string> {
  if (!group) return NO_IDS;
  return new Set(group.listings.map((listing) => listing.id));
}

export function useSavedPins(shown: CarListing[]) {
  const t = useTranslations();
  const locale = useLocale();
  const groups = useMemo(() => groupPins(shown, { t, locale }), [shown, t, locale]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // A removal can take away the pin whose preview is open (a single car's) or
  // the card under the pointer, neither of which then says so. Both are
  // cleared while rendering, React's way to follow a changed prop, so an undo
  // brings the car back with no pin marked and no preview missing.
  if (previewKey !== null && !groups.some((group) => group.key === previewKey)) {
    setPreviewKey(null);
  }
  if (hoverId !== null && !shown.some((listing) => listing.id === hoverId)) {
    setHoverId(null);
  }

  const groupOf = (listingId: string | null) =>
    groups.find((group) => group.listings.some((listing) => listing.id === listingId));
  const previewGroup = groups.find((group) => group.key === previewKey);
  const hoverGroup = groupOf(hoverId);
  const activeGroup = hoverGroup ?? previewGroup;

  /** A pin was activated for `listingId`: its preview opens. Returns its first car in the list's order, to scroll to. */
  function activatePin(listingId: string): number {
    const group = groupOf(listingId);
    if (!group) return -1;
    setPreviewKey(group.key);
    const ids = idsOf(group);
    return shown.findIndex((listing) => ids.has(listing.id));
  }

  return {
    /** The car whose pin is marked: the hovered or focused card's, else the open preview's (MAPUI-27, MAPUI-28). */
    activeId: activeGroup?.listings[0].id ?? null,
    /** The open preview's first car (MAPUI-39). */
    previewId: previewGroup?.listings[0].id ?? null,
    /** Every card of the active pin, outlined (SAVED-11). */
    activeIds: idsOf(activeGroup),
    setHoverId,
    activatePin,
    closePreview: () => setPreviewKey(null),
  };
}
