import { DEFAULT_RADIUS_KM, hasPlace, type SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-alerts.md (ALERTUI-14, ALERTUI-16, ALERTUI-22): the zone
// an alert watches, read off its stored criteria. An alert "has a place" when
// its criteria hold a latitude and a longitude; with none it has no zone.

/** An alert's zone: its criteria point and radius. */
export interface MapZone {
  lat: number;
  lng: number;
  radiusKm: number;
}

/** The criteria's zone, or undefined when they hold no point. */
export function alertMapZone(input: SearchInput): MapZone | undefined {
  if (!hasPlace(input)) return undefined;
  return {
    lat: input.latitude,
    lng: input.longitude,
    radiusKm: input.distanceInKm ?? DEFAULT_RADIUS_KM,
  };
}
