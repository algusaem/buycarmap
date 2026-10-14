"use client";

import { useMap } from "react-leaflet";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

/** Leaflet must not read a press on an overlay control as a press on the map (drag, double-click zoom). */
function stopMapGestures(element: HTMLElement | null) {
  if (!element) return;
  for (const type of ["mousedown", "touchstart", "dblclick", "wheel"]) {
    element.addEventListener(type, (event) => event.stopPropagation());
  }
}

// docs/specs/redesign-map.md (MAPUI-29); docs/design/system/components/MapZoom/README.md.
// «Acercar» and «Alejar», bottom right, replacing Leaflet's own zoom control.
export function MapZoom() {
  const t = useTranslations();
  const map = useMap();

  return (
    <div
      ref={stopMapGestures}
      // No `overflow-hidden`: it clipped the global focus ring along with
      // the buttons' square corners, so each button carries its own matching
      // rounding instead (MAPUI-29).
      className="absolute right-4.5 bottom-6 z-1000 flex flex-col rounded-pill border border-line bg-surface"
    >
      <button
        type="button"
        aria-label={t("map.zoomIn")}
        onClick={() => map.zoomIn(1)}
        className="flex size-10.5 cursor-pointer items-center justify-center rounded-t-pill border-b border-line text-text hover:bg-surface-strong"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-label={t("map.zoomOut")}
        onClick={() => map.zoomOut(1)}
        className="flex size-10.5 cursor-pointer items-center justify-center rounded-b-pill text-text hover:bg-surface-strong"
      >
        <Minus aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
