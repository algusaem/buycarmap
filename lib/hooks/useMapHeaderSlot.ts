import { createExternalStore, useExternalStore } from "@/lib/hooks/createExternalStore";

// docs/specs/redesign-map.md (MAPUI-1). The search pill lives in the desktop
// map header's centre cell (components/nav/MapHeader.tsx), which the root
// layout renders, while its state belongs to the map page
// (components/map/MapView.tsx). The header hands its centre cell over through
// `setMapHeaderSlot` (a callback ref), and the page portals the pill into it.
// A store rather than a lookup in an effect, so the order in which the header
// and the page mount does not matter.
const slot = createExternalStore<HTMLElement | null>(null);

export function setMapHeaderSlot(element: HTMLElement | null): void {
  slot.set(element);
}

/** The header's centre cell while it is on screen, or null. */
export function useMapHeaderSlot(): HTMLElement | null {
  return useExternalStore(slot);
}
