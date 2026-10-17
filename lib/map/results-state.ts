import { RADII_KM } from "@/lib/search/radii";

// docs/specs/redesign-map.md (MAPUI-30 to MAPUI-32). Which state the map's
// results are in, and the radius the empty state offers to widen to.

/** Which state the results are in: the first page loading, failed, found nothing, or listed. */
export type ResultsState = "loading" | "error" | "empty" | "ready";

export function resultsState(isLoading: boolean, error: boolean, count: number): ResultsState {
  if (isLoading) return "loading";
  if (error) return "error";
  return count === 0 ? "empty" : "ready";
}

/** The radius after `radiusKm`, or none at the widest (MAPUI-31 worked example). */
export function nextRadius(radiusKm: number): number | undefined {
  return RADII_KM.find((option) => option > radiusKm);
}
