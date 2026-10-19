"use client";

import type { MapLibreMap } from "maplibre-gl";
import { createContext, useContext } from "react";

// docs/specs/map-maplibre.md: the one `maplibregl.Map` a map component owns
// (lib/hooks/useMapLibre.ts), handed to the parts drawn on it — the pins, the
// preview, the zone, the zoom buttons — so none of them reaches for it any
// other way. A type-only import: this file loads no MapLibre code.

export const MapInstanceContext = createContext<MapLibreMap | null>(null);

/** The map this component is drawn on. Only rendered once the map exists. */
export function useMapInstance(): MapLibreMap {
  const map = useContext(MapInstanceContext);
  if (!map) throw new Error("useMapInstance is used outside a map's MapInstanceContext.");
  return map;
}
