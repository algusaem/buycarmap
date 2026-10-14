import { useCallback, useEffect, useRef, useState } from "react";
import type { CarListing } from "@/interfaces/listing";
import { useCurrentPath } from "@/lib/hooks/useCurrentPath";
import { setResultsSheetFull } from "@/lib/hooks/useResultsSheetFull";
import { useSignInGate } from "@/lib/hooks/useSignInGate";
import { cardDomId } from "@/lib/map/card-dom-id";

// docs/specs/redesign-map.md (MAPUI-21 to MAPUI-24, MAPUI-27, MAPUI-28,
// MAPUI-39, MAPUI-46, MAPUI-53). The map page's own UI state, apart from the
// search itself (useSearchFilters, useListingsSearch): which phone sheet is
// open, where the results sheet rests, which pin and card are active, and
// whether «Crear alerta» is open — with the handlers that keep them in step.

/** The phone results sheet's three positions (MAPUI-23). */
export type ResultsSheetPosition = "peeked" | "middle" | "full";

/** Where «Crear alerta» was opened from: the desktop header's popover or the phone sheet. */
export type CreateAlertVariant = "popover" | "sheet";

/** The car a pin was tapped for first, then the rest in their order (MAPUI-24). */
function withFirst(listings: CarListing[], firstId: string | null): CarListing[] {
  const first = listings.find((listing) => listing.id === firstId);
  if (!first) return listings;
  return [first, ...listings.filter((listing) => listing !== first)];
}

export function useMapPageState(listings: CarListing[], isPhone: boolean) {
  // Where a signed-out buyer comes back to: this very search (MAPUI-37, MAPUI-46).
  const currentPath = useCurrentPath();
  const { requireSession } = useSignInGate();

  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  // MAPUI-23: the phone sheet rests at middle, showing the first card, from
  // a fresh /map load — MAPUI-24's pin tap only changes which car is first.
  const [sheetPosition, setSheetPosition] = useState<ResultsSheetPosition>("middle");
  // The pin whose preview is open, the card under the pointer or focus, and
  // the car a phone pin was tapped for (MAPUI-24, MAPUI-27, MAPUI-28).
  const [pinActiveId, setPinActiveId] = useState<string | null>(null);
  // MAPUI-27: once a previewed car leaves the results for good (a new
  // search, a filter change), its raw id is reset here — not only filtered
  // out of the derived value below — so a later search that brings the same
  // car back does not resurrect its stale preview and active pin. The
  // stored-previous-value pattern from useCriterionDraft.ts: a render-phase
  // `setState`, not an effect, so there is no extra render where the stale
  // id is still live.
  const [previousListings, setPreviousListings] = useState(listings);
  if (listings !== previousListings) {
    setPreviousListings(listings);
    if (pinActiveId && !listings.some((listing) => listing.id === pinActiveId)) {
      setPinActiveId(null);
    }
  }
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState<CreateAlertVariant | null>(null);
  // The phone dialogs' openers — the search summary, «Filtros» and the
  // sheet's «Crear alerta» — where each dialog gives the focus back on close.
  const searchOpenerRef = useRef<HTMLButtonElement>(null);
  const filtersOpenerRef = useRef<HTMLButtonElement>(null);
  const alertOpenerRef = useRef<HTMLButtonElement>(null);

  // The tab bar lives in the root layout and hides while the sheet is full (MAPUI-53).
  useEffect(() => {
    setResultsSheetFull(isPhone && sheetPosition === "full");
    return () => setResultsSheetFull(false);
  }, [isPhone, sheetPosition]);

  // MAPUI-27: a preview whose car dropped out of the current results (a new
  // search, a filter change) must not keep that pin marked active — the
  // popup and its pin would otherwise point at a car no longer in the list.
  // Kept alongside the render-phase reset above as a second guard: every
  // read of the raw state below goes through this too, so there is no
  // render where the stale id is still visible.
  const activePinId =
    pinActiveId && listings.some((listing) => listing.id === pinActiveId) ? pinActiveId : null;

  const closeAlert = useCallback(() => setAlertOpen(null), []);

  function openAlert(variant: CreateAlertVariant) {
    // Until the session request resolves the buyer is neither signed in nor
    // out, so the press is ignored rather than sent to sign in by mistake
    // (the same rule as the heart, FAV-18). Signed out, nothing opens: the
    // buyer goes to sign in and comes back to this very search, and nothing
    // is created on the way (MAPUI-46, ALERT-4).
    if (!requireSession(currentPath)) return;
    setAlertOpen(variant);
    // MAPUI-39: two floating cards must never show at once — opening the
    // desktop header's popover closes an open pin preview.
    if (variant === "popover") setPinActiveId(null);
  }

  function activatePin(listingId: string) {
    setPinActiveId(listingId);
    if (isPhone) {
      // MAPUI-24: the sheet moves to its middle position with that car first.
      setFirstId(listingId);
      setSheetPosition("middle");
      return;
    }
    // MAPUI-27: the car's card is outlined and scrolled into view — at once
    // under reduced motion. "instant", not "auto": "auto" follows the CSS
    // `scroll-behavior`, which app/globals.css sets to smooth everywhere.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(cardDomId(listingId))
      ?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "instant" : "smooth" });
  }

  return {
    currentPath,
    searchOpenerRef,
    filtersOpenerRef,
    alertOpenerRef,
    searchSheetOpen,
    openSearchSheet: () => setSearchSheetOpen(true),
    closeSearchSheet: () => setSearchSheetOpen(false),
    phoneFiltersOpen,
    openPhoneFilters: () => setPhoneFiltersOpen(true),
    closePhoneFilters: () => setPhoneFiltersOpen(false),
    sheetPosition,
    setSheetPosition,
    /** The phone sheet's cards, the tapped pin's car first; the desktop list keeps the search's order. */
    sheetListings: isPhone ? withFirst(listings, firstId) : listings,
    /** The pin to mark: the hovered or focused card's, else the one whose preview is open (MAPUI-27, MAPUI-28). */
    activeId: hoverId ?? activePinId,
    setHoverId,
    /** The car whose preview is open — unlike `activeId`, never set by a hover or focus (MAPUI-39). */
    previewId: activePinId,
    activatePin,
    closePreview: () => setPinActiveId(null),
    alertOpen,
    openAlert,
    closeAlert,
  };
}

export type MapPageState = ReturnType<typeof useMapPageState>;
