"use client";

import { useTranslations } from "next-intl";
import { CarPopover } from "@/components/map/search/CarPopover";
import { LocationPopover } from "@/components/map/search/LocationPopover";
import { PricePopover } from "@/components/map/search/PricePopover";
import { SearchPill } from "@/components/map/search/SearchPill";
import { SearchSheet } from "@/components/map/phone/SearchSheet";
import { useLandingSearch } from "@/lib/hooks/useLandingSearch";

// docs/specs/redesign-entry.md (ENTRY-2, ENTRY-3, ENTRY-5, ENTRY-6). The
// landing's own search: a desktop pill reusing the map's three popovers with
// a held draft (Contracts › "Shared pieces"), and a phone card that opens
// the map's "BUSCAR" sheet. Neither applies a search in place — "Buscar" /
// "Ver coches" both navigate to /map with what was chosen. The draft, the
// open segment, the sheet state and the navigation itself all live in
// `useLandingSearch` (RULES.md §8); this component only consumes it.
export function LandingSearch() {
  const t = useTranslations();
  const {
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
  } = useLandingSearch();

  return (
    <>
      <div data-testid="landing-search-desktop" className="hidden lg:flex">
        <SearchPill
          variant="landing"
          place={draft.place}
          radiusKm={draft.radiusKm}
          brand={draft.brand}
          model={draft.model}
          minPrice={draft.minPrice}
          maxPrice={draft.maxPrice}
          openSegment={openSegment}
          setOpenSegment={setOpenSegment}
          onSearch={search}
          popovers={{
            where: (
              <LocationPopover
                value={draft.place}
                radiusKm={draft.radiusKm}
                onSelect={(place) => edit({ place })}
                onClear={() => edit({ place: null })}
                onRadiusChange={(radiusKm) => edit({ radiusKm })}
              />
            ),
            car: (
              <CarPopover
                brand={draft.brand}
                model={draft.model}
                onSelectBrand={(brand) => edit({ brand, model: "" })}
                onSelectModel={(model) => edit({ model })}
                onClear={() => edit({ brand: "", model: "" })}
                onClose={closeSegment}
              />
            ),
            price: (
              <PricePopover
                minPrice={draft.minPrice}
                maxPrice={draft.maxPrice}
                onApply={(minPrice, maxPrice) => edit({ minPrice, maxPrice })}
              />
            ),
          }}
        />
      </div>

      <button
        type="button"
        ref={phoneCardRef}
        data-testid="landing-search-phone"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-label={t("search.sheetTitle")}
        className="flex w-full cursor-pointer flex-col rounded-sheet border border-line bg-surface p-1.5 text-left transition-[border-color,scale] hover:border-text-muted active:scale-97 motion-reduce:active:scale-none lg:hidden"
      >
        <span aria-hidden="true" className="flex flex-col border-b border-line px-4 py-3">
          <span className="text-overline font-bold uppercase text-text-muted">
            {t("search.where")}
          </span>
          <span className="text-body leading-snug font-semibold text-text-muted">
            {t("search.wherePlaceholder")}
          </span>
        </span>
        <span aria-hidden="true" className="flex flex-col px-4 py-3">
          <span className="text-overline font-bold uppercase text-text-muted">
            {t("search.car")}
          </span>
          <span className="text-body leading-snug font-semibold text-text-muted">
            {t("search.carPlaceholder")}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-13 items-center justify-center rounded-pill bg-lime text-base font-extrabold text-on-lime"
        >
          {t("search.submit")}
        </span>
      </button>

      <SearchSheet
        open={sheetOpen}
        initial={{
          brand: draft.brand || undefined,
          model: draft.model || undefined,
          minPrice: draft.minPrice,
          maxPrice: draft.maxPrice,
        }}
        place={draft.place}
        radiusKm={draft.radiusKm}
        onApply={applySheet}
        onClose={closeSheet}
        returnFocusRef={phoneCardRef}
      />
    </>
  );
}
