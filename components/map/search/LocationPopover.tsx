"use client";

import { useTranslations } from "next-intl";
import type { SelectedLocation, ShownPlace } from "@/interfaces/location";
import { SectionLabel } from "./Combobox";
import { PlaceField } from "./PlaceField";
import { PopoverResetButton } from "./PopoverResetButton";
import { RadiusChoice } from "./RadiusChoice";

// docs/specs/redesign-map.md (MAPUI-3, MAPUI-4, MAPUI-5). "Dónde"'s popover:
// a Nominatim combobox (lib/geo/nominatim.ts's searchLocations, through
// lib/hooks/useLocationSearch.ts — FRONT-7, stays browser-side), the five
// radii (MAPUI-4), and "Toda España" (MAPUI-5). SearchPill frames it in the
// popover card; this is its body.
export interface LocationPopoverProps {
  value: ShownPlace | null;
  radiusKm: number;
  onSelect: (location: SelectedLocation) => void;
  onClear: () => void;
  onRadiusChange: (radiusKm: number) => void;
}

export function LocationPopover({
  value,
  radiusKm,
  onSelect,
  onClear,
  onRadiusChange,
}: LocationPopoverProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4">
      <PlaceField value={value} onSelect={onSelect} />
      <hr className="-mx-5 border-line-soft" />
      <div className="flex flex-col gap-3">
        <SectionLabel>{t("search.radius")}</SectionLabel>
        <RadiusChoice radiusKm={radiusKm} disabled={!value} onChange={onRadiusChange} />
      </div>
      <PopoverResetButton onClick={onClear}>{t("search.allSpain")}</PopoverResetButton>
    </div>
  );
}
