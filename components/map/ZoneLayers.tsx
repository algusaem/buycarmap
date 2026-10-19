"use client";

import type { GeoJSONSourceSpecification } from "maplibre-gl";
import { useEffect } from "react";
import { useMapInstance } from "@/components/map/MapInstanceContext";
import { type MapZone, zoneRing } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-14, ALERTUI-22);
// docs/design/system/components/AlertZone/README.md. The zone an alert
// watches: a circle of its radius around its point, a 2px `lime` border at
// 80 % over a 10 % `lime` veil, and the centre dot, `text` with a 3px `bg`
// border. One GeoJSON source holds the circle (a 64-vertex polygon,
// lib/map/zone.ts) and the centre point; three layers draw them on the map's
// canvas, under the pins, which are DOM elements above it. Being drawn on
// the canvas, it is decorative by construction — no element, no name, no
// pointer target — as the pill and the criteria already say the radius.
//
// MapLibre paint cannot read a CSS variable, so the theme's colours are read
// off the document's own tokens when the zone is drawn: the zone always
// matches app/globals.css, and no colour is written here.

const SOURCE = "zone";
const LAYERS = ["zone-fill", "zone-line", "zone-centre"] as const;

/**
 * The centre dot's radius inside its border. Leaflet drew a 7px circle with
 * its 3px border centred on the edge (1.5px in, 1.5px out); MapLibre draws the
 * border outside the radius, so 5.5px plus 3px keeps the same 8.5px dot.
 */
const CENTRE_RADIUS = 5.5;
const CENTRE_BORDER = 3;

/** A theme colour, read off the document's tokens (`--lime`, `--text`, `--bg`). */
function themeColor(token: "lime" | "text" | "bg"): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
}

function zoneData(zone: MapZone): GeoJSONSourceSpecification["data"] {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [zoneRing(zone)] },
      },
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [zone.lng, zone.lat] },
      },
    ],
  };
}

interface ZoneLayersProps {
  zone: MapZone;
}

/** The circle and the centre dot, on the map this component is drawn on. */
export function ZoneLayers({ zone }: ZoneLayersProps) {
  const map = useMapInstance();
  const { lat, lng, radiusKm } = zone;

  useEffect(() => {
    const lime = themeColor("lime");
    map.addSource(SOURCE, { type: "geojson", data: zoneData({ lat, lng, radiusKm }) });
    map.addLayer({
      id: "zone-fill",
      type: "fill",
      source: SOURCE,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": lime, "fill-opacity": 0.1 },
    });
    map.addLayer({
      id: "zone-line",
      type: "line",
      source: SOURCE,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "line-color": lime, "line-opacity": 0.8, "line-width": 2 },
    });
    map.addLayer({
      id: "zone-centre",
      type: "circle",
      source: SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": CENTRE_RADIUS,
        "circle-color": themeColor("text"),
        "circle-stroke-width": CENTRE_BORDER,
        "circle-stroke-color": themeColor("bg"),
      },
    });

    return () => {
      // The map may already be gone (its component unmounted first).
      if (!map.getStyle()) return;
      for (const id of LAYERS) map.removeLayer(id);
      map.removeSource(SOURCE);
    };
  }, [map, lat, lng, radiusKm]);

  return null;
}
