"use client";

import type { Ref } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { FilterRow } from "@/components/map/filters/FilterRow";
import type { ChipKey } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-20); docs/design/system/components/
// SearchPill/README.md (Móvil en el mapa) and Chip/README.md. Floats over the
// map at phone width: one `surface` row with the magnifier, the search summary
// on two lines and the round violet filters button, and under it, 10px apart,
// the filters row (FilterRow) with «Filtros» filled `surface`.
//
// The violet button repeats «Filtros» from the row below for touch, so it is
// left out of the accessibility tree and the tab order: a screen-reader or
// keyboard user reaches the filters through «Filtros», which also carries the
// count. The summary's two lines come from lib/search/phone-summary.ts.

export interface PhoneSearchBarProps {
  /** "Madrid · 50 km", or "Toda España" with no place chosen. */
  placeSummary: string;
  /** "Cualquier marca · hasta 20.000 €", the car and price sub-summary. */
  carPriceSummary: string;
  input: SearchInput;
  onOpenSearch: () => void;
  onOpenFilters: () => void;
  onRemoveChip: (key: ChipKey) => void;
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
  onRemoveChip,
  filtersOpen = false,
  searchRef,
  filtersRef,
}: PhoneSearchBarProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 rounded-pill border border-line bg-surface py-2.25 pr-2.25 pl-4.5">
        <button
          ref={searchRef}
          type="button"
          aria-haspopup="dialog"
          onClick={onOpenSearch}
          // Reaches the row's edges, so the whole row but the filters button opens «BUSCAR».
          className="-my-2.25 -ml-4.5 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-pill py-2.25 pl-4.5 text-left font-sans text-text"
        >
          <Search aria-hidden="true" strokeWidth={2.4} className="size-4.5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm">{placeSummary}</strong>
            <span className="truncate text-xs text-text-muted">{carPriceSummary}</span>
          </span>
        </button>
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onOpenFilters}
          className="-m-0.75 flex size-11 shrink-0 cursor-pointer items-center justify-center"
        >
          <span className="flex size-9.5 items-center justify-center rounded-pill bg-violet text-on-violet">
            <SlidersHorizontal className="size-4" />
          </span>
        </button>
      </div>
      <FilterRow
        input={input}
        onRemove={onRemoveChip}
        onOpenFilters={onOpenFilters}
        panelOpen={filtersOpen}
        filtersRef={filtersRef}
        overMap
      />
    </div>
  );
}
