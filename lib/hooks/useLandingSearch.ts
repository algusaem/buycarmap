"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SelectedLocation } from "@/interfaces/location";
import type { SearchPopover } from "@/lib/hooks/useSearchFilters";
import { DEFAULT_RADIUS_KM } from "@/lib/search/schema";
import { EMPTY_URL_FILTERS, mapSearchUrl } from "@/lib/search/url-state";
import type { SheetSearch } from "@/interfaces/search-sheet";

export interface LandingDraft {
  place: SelectedLocation | null;
  radiusKm: number;
  brand: string;
  model: string;
  minPrice?: number;
  maxPrice?: number;
}

const INITIAL_DRAFT: LandingDraft = {
  place: null,
  radiusKm: DEFAULT_RADIUS_KM,
  brand: "",
  model: "",
  minPrice: undefined,
  maxPrice: undefined,
};

/**
 * `/map` with exactly what was chosen, through `lib/search/url-state.ts`'s
 * shared `mapSearchUrl` (docs/specs/redesign-entry.md, Contracts › "Landing
 * to map") — never through `?q=` (ENTRY-6). Named apart from the imported
 * `mapSearchUrl` it calls, so the two are never confused at a call site.
 */
function draftToUrl(draft: LandingDraft): string {
  return mapSearchUrl({
    ...EMPTY_URL_FILTERS,
    brand: draft.brand,
    model: draft.model,
    minPrice: draft.minPrice,
    maxPrice: draft.maxPrice,
    selectedLocation: draft.place ?? undefined,
    distanceInKm: draft.radiusKm,
  });
}

// docs/specs/redesign-entry.md (ENTRY-2, ENTRY-3, ENTRY-5, ENTRY-6). The
// landing search's state and navigation, held here rather than in
// LandingSearch.tsx (RULES.md §8: state logic goes in a custom hook): the
// draft every popover edits, which segment (if any) is open, the «BUSCAR»
// sheet's own open state, and the one navigation both «Buscar» and «Ver
// coches» end in.
export function useLandingSearch() {
  const router = useRouter();
  const [draft, setDraft] = useState<LandingDraft>(INITIAL_DRAFT);
  const [openSegment, setOpenSegment] = useState<SearchPopover | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const phoneCardRef = useRef<HTMLButtonElement>(null);

  const edit = (patch: Partial<LandingDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const closeSegment = () => setOpenSegment(null);

  function navigateTo(target: LandingDraft) {
    router.push(draftToUrl(target));
  }

  function search() {
    navigateTo(draft);
  }

  function openSheet() {
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  function applySheet(result: SheetSearch) {
    setSheetOpen(false);
    navigateTo({
      place: result.place,
      radiusKm: result.distanceInKm ?? draft.radiusKm,
      brand: result.brand ?? "",
      model: result.model ?? "",
      minPrice: result.minPrice,
      maxPrice: result.maxPrice,
    });
  }

  return {
    draft,
    edit,
    openSegment,
    setOpenSegment,
    closeSegment,
    sheetOpen,
    openSheet,
    closeSheet,
    phoneCardRef,
    search,
    applySheet,
  };
}
