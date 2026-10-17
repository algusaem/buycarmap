"use client";

import type { FitBoundsOptions } from "leaflet";
import { AttributionControl, MapContainer, TileLayer } from "react-leaflet";
import { cartoTileUrl } from "@/components/map/ListingsMap";
import { ZoneLayers, zoneBounds } from "@/components/map/ZoneLayers";
import type { MapZone } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-24): the phone zone map is static.
// It sits in a scrolling page, where a draggable map would take the scroll,
// so dragging, the scroll wheel, double-click, touch, box and keyboard zoom
// are all off, and it draws no zoom control. It holds no focusable element:
// with the keyboard off Leaflet gives its container no tab stop, and the
// attribution is plain text, with no link and without Leaflet's own linked
// prefix. It frames the zone once.

// F6-alerta: in the 350 × 180 zone the circle is 128px across, its centre at
// x = 215, clear of the pill on the left: 80px more padding on the left.
const ZONE_PADDING = {
  paddingTopLeft: [80, 26],
  paddingBottomRight: [0, 26],
} satisfies FitBoundsOptions;
/** OpenStreetMap's and CARTO's credit, as text: the map takes no focus. */
const ATTRIBUTION = "© OpenStreetMap © CARTO";

interface ZoneMapCanvasProps {
  zone: MapZone;
}

export function ZoneMapCanvas({ zone }: ZoneMapCanvasProps) {
  return (
    <MapContainer
      bounds={zoneBounds(zone)}
      boundsOptions={ZONE_PADDING}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      fadeAnimation={false}
      className="size-full"
    >
      <TileLayer attribution={ATTRIBUTION} url={cartoTileUrl()} />
      <AttributionControl prefix={false} />
      <ZoneLayers zone={zone} />
    </MapContainer>
  );
}
