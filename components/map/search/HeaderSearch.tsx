"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { useSearchFilters } from "@/lib/hooks/useSearchFilters";
import { useMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import { CarPopover } from "./CarPopover";
import { LocationPopover } from "./LocationPopover";
import { PricePopover } from "./PricePopover";
import { SearchPill } from "./SearchPill";

// docs/specs/redesign-map.md (MAPUI-1 to MAPUI-12, MAPUI-39). The desktop
// search: the pill with its three popovers and «Crear alerta», portalled into
// the map header's centre cell (lib/hooks/useMapHeaderSlot.ts), which the
// root layout renders while the map page owns the state.
interface HeaderSearchProps {
  filters: ReturnType<typeof useSearchFilters>;
  createAlertOpen: boolean;
  onCreateAlertOpenChange: (open: boolean) => void;
  createAlert: ReactNode;
}

export function HeaderSearch({
  filters,
  createAlertOpen,
  onCreateAlertOpenChange,
  createAlert,
}: HeaderSearchProps) {
  const headerSlot = useMapHeaderSlot();
  if (!headerSlot) return null;

  const place = filters.selectedLocation ?? null;
  const closePopover = () => filters.setActivePopover(null);

  return createPortal(
    <SearchPill
      place={place}
      radiusKm={filters.distanceInKm}
      brand={filters.brand}
      model={filters.model}
      minPrice={filters.minPrice}
      maxPrice={filters.maxPrice}
      openSegment={filters.activePopover}
      onOpenSegment={filters.setActivePopover}
      onCloseSegment={closePopover}
      onSearch={filters.triggerSearch}
      popovers={{
        where: (
          <LocationPopover
            value={place}
            radiusKm={filters.distanceInKm}
            onSelect={filters.setLocation}
            onClear={() => filters.setLocation(undefined)}
            onRadiusChange={filters.setDistanceInKm}
          />
        ),
        car: (
          <CarPopover
            brand={filters.brand}
            model={filters.model}
            onSelectBrand={filters.setBrand}
            onSelectModel={filters.setModel}
            onClear={() => filters.setBrand("")}
            onClose={closePopover}
          />
        ),
        price: (
          <PricePopover
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onApply={(minPrice, maxPrice) => filters.updateInput({ minPrice, maxPrice })}
          />
        ),
      }}
      createAlertOpen={createAlertOpen}
      onCreateAlertOpenChange={onCreateAlertOpenChange}
      createAlert={createAlert}
    />,
    headerSlot,
  );
}
