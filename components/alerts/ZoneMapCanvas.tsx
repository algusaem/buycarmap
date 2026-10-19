"use client";

import { useEffect, useRef } from "react";
import { MapInstanceContext, useMapInstance } from "@/components/map/MapInstanceContext";
import { ZoneLayers } from "@/components/map/ZoneLayers";
import { useMapLibre } from "@/lib/hooks/useMapLibre";
import { type MapZone, zoneBounds } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-24); docs/specs/map-maplibre.md
// (MAPLIBRE-5, MAPLIBRE-15): the phone zone map is static. It sits in a
// scrolling page, where a draggable map would take the scroll, so it is not
// interactive at all — no drag, wheel, double-click, touch, box or keyboard
// zoom — and it draws no zoom control. It holds no focusable element: a
// non-interactive MapLibre canvas takes no tab stop, and the attribution is
// plain text, with no link and no control. It frames the zone once, at once.
// Without WebGL it shows the ground alone: no status pill, no attribution.

// F6-alerta: in the 350 × 180 zone the circle is 128px across, its centre at
// x = 215, clear of the pill on the left: 80px more padding on the left.
const ZONE_PADDING = { top: 26, left: 80, right: 0, bottom: 26 };
/** OpenFreeMap's required credit (MAPLIBRE-5), as text: the map takes no focus. */
const ATTRIBUTION = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

interface FitZoneProps {
  zone: MapZone;
}

/** Frames the zone, once per zone, with no animation: the map is a still picture. */
function FitZone({ zone }: FitZoneProps) {
  const map = useMapInstance();
  const { lat, lng, radiusKm } = zone;

  useEffect(() => {
    map.fitBounds(zoneBounds({ lat, lng, radiusKm }), { padding: ZONE_PADDING, animate: false });
  }, [map, lat, lng, radiusKm]);

  return null;
}

interface ZoneMapCanvasProps {
  zone: MapZone;
}

export function ZoneMapCanvas({ zone }: ZoneMapCanvasProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, unavailable } = useMapLibre(containerRef, viewRef, { interactive: false });

  return (
    <div ref={viewRef} data-map="zone" className="relative size-full">
      <div ref={containerRef} className="size-full" />
      {map && !unavailable && (
        <MapInstanceContext.Provider value={map}>
          <ZoneLayers zone={zone} />
          <FitZone zone={zone} />
          <span className="map-attribution absolute right-0 bottom-0">{ATTRIBUTION}</span>
        </MapInstanceContext.Provider>
      )}
    </div>
  );
}
