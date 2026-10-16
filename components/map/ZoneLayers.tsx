"use client";

import L, { type LeafletEvent } from "leaflet";
import { Circle, CircleMarker } from "react-leaflet";
import type { MapZone } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-14, ALERTUI-22);
// docs/design/system/components/AlertZone/README.md. The zone an alert
// watches: a circle of its radius around its point, a 2px `lime` border at
// 80 % over a 10 % `lime` veil, and the centre dot, `text` with a 3px `bg`
// border. Drawn in Leaflet's overlay pane, under the pins. It is decorative —
// the pill and the criteria already say the radius — so both shapes are
// `aria-hidden` and take no pointer. The colours are the theme's, as classes
// on the SVG paths: CSS outranks the presentation attributes Leaflet writes.

/** The zone's bounds, for fitting a map to it. */
export function zoneBounds(zone: MapZone): L.LatLngBounds {
  return L.latLng(zone.lat, zone.lng).toBounds(zone.radiusKm * 2000);
}

/** The board's centre dot: 7px, with a 3px border. */
const CENTRE_RADIUS = 7;

function hideFromAssistiveTech(event: LeafletEvent) {
  if (!(event.target instanceof L.Path)) return;
  event.target.getElement()?.setAttribute("aria-hidden", "true");
}

const DECORATIVE = { add: hideFromAssistiveTech };

const CIRCLE_STYLE = {
  weight: 2,
  opacity: 1,
  fill: true,
  fillOpacity: 1,
  className: "stroke-lime/80 fill-lime/10",
} satisfies L.PathOptions;

const CENTRE_STYLE = {
  weight: 3,
  opacity: 1,
  fill: true,
  fillOpacity: 1,
  className: "stroke-bg fill-text",
} satisfies L.PathOptions;

interface ZoneLayersProps {
  zone: MapZone;
}

/** The circle and the centre dot, inside a react-leaflet map. */
export function ZoneLayers({ zone }: ZoneLayersProps) {
  const center: L.LatLngExpression = [zone.lat, zone.lng];

  return (
    <>
      <Circle
        center={center}
        radius={zone.radiusKm * 1000}
        interactive={false}
        pathOptions={CIRCLE_STYLE}
        eventHandlers={DECORATIVE}
      />
      <CircleMarker
        center={center}
        radius={CENTRE_RADIUS}
        interactive={false}
        pathOptions={CENTRE_STYLE}
        eventHandlers={DECORATIVE}
      />
    </>
  );
}
