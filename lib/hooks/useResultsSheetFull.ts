import { createExternalStore, useExternalStore } from "@/lib/hooks/createExternalStore";

// docs/specs/redesign-map.md (MAPUI-53). The tab bar, which the root layout
// renders, hides while the map's results sheet is full; the sheet's position
// belongs to the map page (components/map/MapView.tsx). The page reports it
// through `setResultsSheetFull` and the tab bar reads it.
const sheetFull = createExternalStore(false);

export function setResultsSheetFull(value: boolean): void {
  sheetFull.set(value);
}

/** Whether the map's results sheet is in its full position. */
export function useResultsSheetFull(): boolean {
  return useExternalStore(sheetFull);
}
