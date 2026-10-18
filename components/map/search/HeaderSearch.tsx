"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { FilterPanel } from "@/components/map/filters/FilterPanel";
import { FilterRow } from "@/components/map/filters/FilterRow";
import type { useSearchFilters } from "@/lib/hooks/useSearchFilters";
import { useMapFiltersSlot, useMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import { CarPopover } from "./CarPopover";
import { LocationPopover } from "./LocationPopover";
import { PricePopover } from "./PricePopover";
import { SearchPill } from "./SearchPill";

// docs/specs/redesign-map.md (MAPUI-1 to MAPUI-13, MAPUI-19, MAPUI-39,
// MAPUI-63, MAPUI-64). The desktop search, portalled into the map header's
// two rows (lib/hooks/useMapHeaderSlot.ts), which the root layout renders
// while the map page owns the state: the pill with its three popovers and
// «Crear alerta» into row one's centre, and «Filtros» with its dropdown and
// the quick filters (FilterRow) into row two. A quick filter applies at once
// (`applyInput`), the same path the phone quick filters use — not the panel's
// debounced `updateInput` (MAPUI-63).
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
  const filtersSlot = useMapFiltersSlot();

  const place = filters.selectedLocation ?? null;
  const closePopover = () => filters.setActivePopover(null);
  const closeFilters = () => filters.setFiltersOpen(false);

  return (
    <>
      {headerSlot &&
        createPortal(
          <SearchPill
            place={place}
            radiusKm={filters.distanceInKm}
            brand={filters.brand}
            model={filters.model}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            openSegment={filters.activePopover}
            setOpenSegment={filters.setActivePopover}
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
        )}
      {filtersSlot &&
        createPortal(
          <FilterRow
            input={filters.input}
            onOpenFilters={() => filters.setFiltersOpen(true)}
            onApplyQuick={(patch) => filters.applyInput(patch)}
            panelOpen={filters.isOpen}
            onClosePanel={closeFilters}
            panel={
              <FilterPanel
                mode="desktop"
                input={filters.input}
                onChange={filters.updateInput}
                onClear={filters.clearAll}
                onCloseDesktop={closeFilters}
              />
            }
          />,
          filtersSlot,
        )}
    </>
  );
}
