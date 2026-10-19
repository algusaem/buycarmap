import { boundsOf, type LngLat } from "@/lib/map/view";
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

/** The Earth's mean radius in km, for the great-circle formula below. */
const EARTH_RADIUS_KM = 6371;

/** How many vertices draw the zone's circle: enough to read as round at any zoom. */
const ZONE_VERTICES = 64;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * The zone's circle as a closed GeoJSON ring (ALERTUI-14): 64 points at the
 * zone's radius from its centre, the first due north and then clockwise, the
 * first repeated at the end. Each point is the great-circle destination from
 * the centre at that bearing, so the ring is a true circle on the ground.
 */
export function zoneRing(zone: MapZone): LngLat[] {
  const lat1 = toRadians(zone.lat);
  const lng1 = toRadians(zone.lng);
  const angular = zone.radiusKm / EARTH_RADIUS_KM;

  const ring = Array.from({ length: ZONE_VERTICES }, (_, index): LngLat => {
    const bearing = (2 * Math.PI * index) / ZONE_VERTICES;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    return [toDegrees(lng2), toDegrees(lat2)];
  });
  return [...ring, ring[0]];
}

/** The zone's bounds, south-west then north-east, for fitting a map to it. */
export function zoneBounds(zone: MapZone): [LngLat, LngLat] {
  return boundsOf(zoneRing(zone));
}
