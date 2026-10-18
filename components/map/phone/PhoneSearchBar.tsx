"use client";

import type { Ref } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { FiltersBadge } from "@/components/map/filters/FiltersBadge";
import { QuickFilters } from "@/components/map/filters/QuickFilters";
import { useFilterCount } from "@/lib/hooks/useFilterCount";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-20, MAPUI-22, MAPUI-63, MAPUI-67);
// docs/design/system/components/SearchPill/README.md (Móvil en el mapa) and
// Chip/README.md. The content of the `surface` band across the top of the
// phone map. Row one: the 56px search summary, with the magnifier and the
// summary on two lines, and beside it, 12px apart, the 44px round «Filtros»
// button that opens the full-screen filters dialog. Under them, 16px apart,
// the quick filters, scrolling sideways.
//
// «Filtros» is named by `map.filters` alone; the violet badge at its corner
// counts the active criteria (lib/search/filter-chips.ts's filterChips) as
// visible text, left out of the name, and shows only while one is active —
// an `aria-describedby` sr-only span (`map.filtersActive`) carries that count
// to assistive tech instead, since the badge itself is `aria-hidden`. It
// announces its dialog (`aria-haspopup`, `aria-expanded` while
// `filtersOpen`), and `filtersRef` lets the dialog give the focus back to it
// on close. The quick filters' scroller clips at its padding box, so it pads
// 8px above and below (taken back with a negative margin): room for the
// toggles' 44px hit areas and their focus rings. The summary's two lines come
// from lib/search/phone-summary.ts.

export interface PhoneSearchBarProps {
  /** "Madrid · 50 km", or "Toda España" with no place chosen. */
  placeSummary: string;
  /** "Cualquier marca · hasta 20.000 €", the car and price sub-summary. */
  carPriceSummary: string;
  input: SearchInput;
  onOpenSearch: () => void;
  onOpenFilters: () => void;
  /** A quick filter's patch, applied at once (MAPUI-22, MAPUI-63). */
  onApplyQuick: (patch: Partial<SearchInput>) => void;
  /** Whether the filters dialog is open, for «Filtros»'s `aria-expanded`. */
  filtersOpen?: boolean;
  /** The summary and «Filtros», where focus returns when their dialogs close. */
  searchRef?: Ref<HTMLButtonElement>;
  filtersRef?: Ref<HTMLButtonElement>;
}

export function PhoneSearchBar({
  placeSummary,
  carPriceSummary,
  input,
  onOpenSearch,
  onOpenFilters,
  onApplyQuick,
  filtersOpen = false,
  searchRef,
  filtersRef,
}: PhoneSearchBarProps) {
  const t = useTranslations();
  const { count, descriptionId: filtersDescriptionId, describedBy } = useFilterCount(input);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pr-band-right pl-band-left">
        <button
          ref={searchRef}
          type="button"
          aria-haspopup="dialog"
          onClick={onOpenSearch}
          className="flex h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-pill border border-line bg-surface px-4.5 text-left font-sans text-text"
        >
          <Search aria-hidden="true" strokeWidth={2.4} className="size-4.5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm">{placeSummary}</strong>
            <span className="truncate text-xs text-text-muted">{carPriceSummary}</span>
          </span>
        </button>
        <button
          ref={filtersRef}
          type="button"
          aria-label={t("map.filters")}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-describedby={describedBy}
          onClick={onOpenFilters}
          className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill border border-line text-text"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4.5" />
          <FiltersBadge
            count={count}
            descriptionId={filtersDescriptionId}
            className="absolute -top-1 -right-1"
          />
        </button>
      </div>
      <QuickFilters
        input={input}
        onApply={onApplyQuick}
        className="-my-2 overflow-x-auto py-2 pr-band-right pl-band-left"
      />
    </div>
  );
}
