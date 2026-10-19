"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMapInstance } from "@/components/map/MapInstanceContext";

// docs/specs/redesign-map.md (MAPUI-29); docs/design/system/components/MapZoom/README.md.
// «Acercar» and «Alejar», bottom right, over the map: each changes its zoom
// by one level through the map's own zoom, which animates it (motion.md ›
// Out of scope). They sit beside the map's container, not inside it, so a
// press on them never reaches the map's own gestures. Hover fills
// surface-strong and a press scales to 0.97, in the state transition
// (MOTION-6).
export function MapZoom() {
  const t = useTranslations();
  const map = useMapInstance();

  return (
    <div
      // No `overflow-hidden`: it clipped the global focus ring along with
      // the buttons' square corners, so each button carries its own matching
      // rounding instead (MAPUI-29).
      className="absolute right-4.5 bottom-6 z-1000 flex flex-col rounded-pill border border-line bg-surface"
    >
      <button
        type="button"
        aria-label={t("map.zoomIn")}
        onClick={() => map.zoomIn()}
        className="flex size-10.5 cursor-pointer items-center justify-center rounded-t-pill border-b border-line text-text transition-[background-color,scale] hover:bg-surface-strong active:scale-97 motion-reduce:active:scale-none"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-label={t("map.zoomOut")}
        onClick={() => map.zoomOut()}
        className="flex size-10.5 cursor-pointer items-center justify-center rounded-b-pill text-text transition-[background-color,scale] hover:bg-surface-strong active:scale-97 motion-reduce:active:scale-none"
      >
        <Minus aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
