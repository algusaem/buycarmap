"use client";

import * as Sentry from "@sentry/nextjs";
import {
  AttributionControl,
  type ErrorEvent,
  GPUInitializationError,
  MapLibreMap,
  setWorkerUrl,
} from "maplibre-gl";
import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef, useState } from "react";
import { mapStyle, OPENFREEMAP_ATTRIBUTION } from "@/lib/map/style";
import { DEFAULT_VIEW, formatMapCenter, formatMapNumber } from "@/lib/map/view";

// docs/specs/map-maplibre.md; ADR 0023. One `maplibregl.Map` per container,
// created when the container mounts and removed when it unmounts, with no
// React wrapper library: the map components sync their pins, preview and zone
// to the map this returns. It never rotates or tilts (MAPLIBRE-4), starts on
// the default view (MAPLIBRE-3), and writes its view onto `view` on `load`
// and on every `moveend`, for the e2e tests (spec › Contracts › Test hooks).
//
// The map is handed out once its style has loaded, so a source or a layer can
// be added to it at once. A browser without WebGL cannot create it at all
// (MAPLIBRE-15): `unavailable` says so, and the map area shows that instead.
// That is an expected condition, not a fault, so it is neither logged nor
// reported.

// MapLibre looks for its web worker next to its own script, which the bundler
// has moved into a chunk of its own; this hands it the worker file as the
// bundler emits it, from this site's origin (`worker-src 'self'`).
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

interface MapLibreOptions {
  /** False for a static map: no gesture, no keyboard, no attribution control (ALERTUI-24). */
  interactive: boolean;
}

interface MapLibreState {
  /** The map, once its style has loaded. */
  map: MapLibreMap | null;
  /** The browser cannot draw the map: no WebGL, or its WebGL context was lost. */
  unavailable: boolean;
}

/** Whether a MapLibre error is a tile or source that failed to load (MAPLIBRE-14). */
function isSourceError(event: ErrorEvent): boolean {
  return "sourceId" in event;
}

export function useMapLibre(
  container: RefObject<HTMLDivElement | null>,
  view: RefObject<HTMLElement | null>,
  { interactive }: MapLibreOptions,
): MapLibreState {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const t = useTranslations();
  // MapLibre names its compact attribution button in English; it takes ours
  // instead. Read through a ref, so a new `t` never rebuilds the map.
  const toggleAttributionRef = useRef(t("map.toggleAttribution"));
  toggleAttributionRef.current = t("map.toggleAttribution");

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
        container: element,
        style: mapStyle,
        center: DEFAULT_VIEW.center,
        zoom: DEFAULT_VIEW.zoom,
        interactive,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        locale: { "AttributionControl.ToggleAttribution": toggleAttributionRef.current },
      });
    } catch (error) {
      if (!(error instanceof GPUInitializationError)) throw error;
      // No WebGL: MapLibre stops half-built. Its canvas goes, the ground stays.
      element.replaceChildren();
      setUnavailable(true);
      return;
    }

    // MapLibre makes its canvas a region named «Map», in English. The map
    // area around it is already the named region (the page's section), so
    // the canvas would be a second one of the same name: it stays a plain
    // canvas, as Leaflet's container was.
    const canvas = instance.getCanvas();
    canvas.removeAttribute("role");
    canvas.removeAttribute("aria-label");
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    if (interactive) {
      instance.addControl(
        new AttributionControl({ compact: true, customAttribution: OPENFREEMAP_ATTRIBUTION }),
        "bottom-right",
      );
    }

    const writeView = () => {
      const target = view.current;
      if (!target) return;
      const center = instance.getCenter();
      target.dataset.mapCenter = formatMapCenter(center.lat, center.lng);
      target.dataset.mapZoom = formatMapNumber(instance.getZoom());
      target.dataset.mapBearing = formatMapNumber(instance.getBearing());
      target.dataset.mapPitch = formatMapNumber(instance.getPitch());
    };
    instance.on("load", writeView);
    instance.on("moveend", writeView);
    instance.on("error", (event) => {
      // A tile or the tile source failing to load (OpenFreeMap down or slow)
      // is expected: the map keeps its ground colour and its pins, and nothing
      // reaches the user (MAPLIBRE-14). Anything else is a fault.
      if (isSourceError(event)) return;
      Sentry.captureException(event.error);
    });
    instance.on("webglcontextlost", () => setUnavailable(true));
    instance.once("style.load", () => setMap(instance));

    return () => {
      setMap(null);
      instance.remove();
    };
  }, [container, view, interactive]);

  return { map, unavailable };
}
