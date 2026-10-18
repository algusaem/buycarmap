import { createExternalStore, useExternalStore } from "@/lib/hooks/createExternalStore";

// docs/specs/redesign-map.md (MAPUI-1, MAPUI-59). The desktop map header
// (components/nav/MapHeader.tsx), which the root layout renders, holds two
// cells whose state belongs to the map page (components/map/MapView.tsx):
// row one's centre, for the search pill and «Crear alerta», and row two, for
// «Filtros» and the quick filters. The header hands each cell over through
// its setter (a callback ref), and the page portals its part into it. A
// store rather than a lookup in an effect, so the order in which the header
// and the page mount does not matter.
const slot = createExternalStore<HTMLElement | null>(null);
const filtersSlot = createExternalStore<HTMLElement | null>(null);

export function setMapHeaderSlot(element: HTMLElement | null): void {
  slot.set(element);
}

/** The header's centre cell while it is on screen, or null. */
export function useMapHeaderSlot(): HTMLElement | null {
  return useExternalStore(slot);
}

export function setMapFiltersSlot(element: HTMLElement | null): void {
  filtersSlot.set(element);
}

/** The header's second row while it is on screen, or null. */
export function useMapFiltersSlot(): HTMLElement | null {
  return useExternalStore(filtersSlot);
}
