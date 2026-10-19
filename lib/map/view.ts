// docs/specs/map-maplibre.md (Contracts › Test hooks): how each map writes
// its view onto its container, so the e2e tests can read it — `data-map-center`
// as «lat,lng» with 4 decimals, `data-map-zoom`, `data-map-bearing` and
// `data-map-pitch` with 2 decimals and the trailing zeros trimmed.

/** A zoom, bearing or pitch to 2 decimals, trailing zeros trimmed: 5 → «5», 13.456 → «13.46». */
export function formatMapNumber(value: number): string {
  // Number() drops the zeros toFixed() pads with, and turns −0 into 0.
  return String(Number(value.toFixed(2)));
}

/** A map centre as «lat,lng», each to 4 decimals. */
export function formatMapCenter(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** A point as MapLibre and GeoJSON take it: longitude first. */
export type LngLat = [lng: number, lat: number];

/**
 * Where every map starts: mainland Spain, whole (MAP-25, MAPLIBRE-3). An
 * alert's map comes back to it (ALERTUI-16). Zoom 5 on MapLibre's 512px
 * tiles is Leaflet's zoom 6.
 */
export const DEFAULT_VIEW = { center: [-3.7038, 40.4168] as LngLat, zoom: 5 };

/** The smallest bounds holding every point, south-west then north-east. */
export function boundsOf(points: readonly LngLat[]): [LngLat, LngLat] {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
