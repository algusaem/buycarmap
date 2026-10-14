"use client";

import { type RefObject, useState } from "react";
import { useTranslations } from "next-intl";
import { CarTypeahead } from "@/components/map/search/CarTypeahead";
import { closeListboxFirst } from "@/components/map/search/Combobox";
import { PanelSection } from "@/components/map/search/PanelSection";
import { PlaceField } from "@/components/map/search/PlaceField";
import { PriceRange } from "@/components/map/search/PriceRange";
import { RadiusChoice } from "@/components/map/search/RadiusChoice";
import { PhoneBottomSheet, SheetHeader, ShowCarsFooter } from "./SheetChrome";
import type { SelectedLocation } from "@/interfaces/location";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-21); docs/design/system/components/
// SearchPopover/README.md (Móvil: la hoja «BUSCAR»). A bottom sheet over the
// dimmed map with «Dónde», «Coche» and «Precio». Nothing chosen here reaches
// the search until «Ver coches», which hands it all to `onApply`; closing
// discards it (owner decision, "Decisions and rationale" › "Desktop applies
// at once, the phone applies on «Ver coches»"), and «Borrar» only empties the
// sheet's fields. Escape closes an open list first, then the sheet
// (closeListboxFirst).
/** What «Ver coches» hands over: the edited criteria and the place, `null` for «Toda España». */
interface SheetSearch extends SearchInput {
  place: SelectedLocation | null;
}

export interface SearchSheetProps {
  open: boolean;
  initial: SearchInput;
  /** The chosen place, which `SearchInput` carries only as coordinates. */
  place?: SelectedLocation | null;
  /** The filters' radius, kept even while no place is chosen (`SearchInput` then carries none). */
  radiusKm: number;
  onApply: (search: SheetSearch) => void;
  onClose: () => void;
  /** The search summary that opened the sheet, focused again when it closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function SearchSheet({
  open,
  initial,
  place = null,
  radiusKm,
  onApply,
  onClose,
  returnFocusRef,
}: SearchSheetProps) {
  return (
    <PhoneBottomSheet
      open={open}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      overlayClassName="bg-bg/72 lg:hidden"
      className="max-h-sheet-max lg:hidden"
      entrance="fade"
      onEscapeKeyDown={closeListboxFirst}
    >
      <SheetContent
        initial={initial}
        place={place}
        radiusKm={radiusKm}
        onApply={onApply}
        onClose={onClose}
      />
    </PhoneBottomSheet>
  );
}

interface Draft {
  place: SelectedLocation | null;
  radiusKm: number;
  brand: string;
  model: string;
  minPrice?: number;
  maxPrice?: number;
}

interface SheetContentProps {
  initial: SearchInput;
  place: SelectedLocation | null;
  radiusKm: number;
  onApply: (search: SheetSearch) => void;
  onClose: () => void;
}

/** The sheet's fields, mounted on each opening so they start from the search. */
function SheetContent({ initial, place, radiusKm, onApply, onClose }: SheetContentProps) {
  const t = useTranslations();
  const [draft, setDraft] = useState<Draft>({
    place,
    radiusKm,
    brand: initial.brand ?? "",
    model: initial.model ?? "",
    minPrice: initial.minPrice,
    maxPrice: initial.maxPrice,
  });
  const edit = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  function showCars() {
    onApply({
      brand: draft.brand || undefined,
      model: draft.model || undefined,
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
      distanceInKm: draft.radiusKm,
      place: draft.place,
    });
  }

  return (
    <>
      <SheetHeader
        title={t("search.sheetTitle")}
        closeLabel={t("search.close")}
        onClose={onClose}
        onClear={() =>
          edit({ place: null, brand: "", model: "", minPrice: undefined, maxPrice: undefined })
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6.5 overflow-y-auto px-5 py-5.5">
        <PanelSection level={3} title={t("search.where")}>
          <PlaceField value={draft.place} onSelect={(chosen) => edit({ place: chosen })} />
          <RadiusChoice
            radiusKm={draft.radiusKm}
            disabled={!draft.place}
            onChange={(radiusKm) => edit({ radiusKm })}
          />
        </PanelSection>
        <PanelSection level={3} title={t("search.car")}>
          <CarTypeahead
            brand={draft.brand}
            model={draft.model}
            onSelectBrand={(brand) => edit({ brand, model: "" })}
            onSelectModel={(model) => edit({ model })}
            onClear={() => edit({ brand: "", model: "" })}
          />
        </PanelSection>
        <PanelSection level={3} title={t("search.price")}>
          <PriceRange
            minPrice={draft.minPrice}
            maxPrice={draft.maxPrice}
            onApply={(minPrice, maxPrice) => edit({ minPrice, maxPrice })}
          />
        </PanelSection>
      </div>
      <ShowCarsFooter onShowCars={showCars} />
    </>
  );
}
