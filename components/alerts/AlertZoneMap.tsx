"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { MapZone } from "@/lib/map/zone";

// MapLibre cannot run server-side (as in components/map/MapResultsArea.tsx).
const ZoneMapCanvas = dynamic(
  async () => (await import("@/components/alerts/ZoneMapCanvas")).ZoneMapCanvas,
  { ssr: false },
);

// docs/specs/redesign-alerts.md (ALERTUI-22 to ALERTUI-24);
// AlertZone/README.md › móvil and F6-alerta. The zone on an alert's page at
// phone width: a region named «Zona de la alerta», 180px tall and the
// content's full width, `radius-card` with a `line` border, holding the
// static map with the circle and the centre dot, and the pill with the zone
// alone, all in lime. No pin: the matches are the rows under it.

interface AlertZoneMapProps {
  zone: MapZone;
  /** «Madrid · 50 km», or «50 km» with no place name. */
  label: string;
}

export function AlertZoneMap({ zone, label }: AlertZoneMapProps) {
  const t = useTranslations();

  return (
    <section
      aria-label={t("alerts.zoneLabel")}
      className="relative isolate h-45 w-full shrink-0 overflow-hidden rounded-card border border-line bg-map-ground"
    >
      <ZoneMapCanvas zone={zone} />
      {/* The same inset on the right as on the left: the pill, as wide as its
          zone up to this strip, cuts a long one to one line with «…». */}
      <div className="absolute top-4.5 right-4.5 left-4.5 z-1000">
        <span className="block w-fit max-w-full truncate rounded-pill border border-line bg-surface px-4 py-2.5 text-sm font-bold text-lime">
          {label}
        </span>
      </div>
    </section>
  );
}
