"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { SavedMapFrame } from "@/components/favorites/SavedLayout";
import { MapPill } from "@/components/map/ResultsStates";
import type { CarListing } from "@/interfaces/listing";
import type { MapZone } from "@/lib/map/zone";

// Leaflet cannot run server-side (as in components/map/MapResultsArea.tsx).
const ListingsMap = dynamic(
  async () => (await import("@/components/map/ListingsMap")).ListingsMap,
  { ssr: false },
);

// docs/specs/redesign-alerts.md (ALERTUI-14 to ALERTUI-17); AlertZone,
// StatusPill and PricePin READMEs. The desktop map of both alert routes,
// «Mapa de la alerta», beside the list: the open alert's zone under one pin
// per match, fitted once each time an alert opens, the preview with its
// heart, and the pill naming the alert with its zone in lime. With no alert
// it shows only «Aquí verás la zona de cada alerta», a polite status
// (ALERTUI-40). The list and the map stay in sync through the page's pins
// (lib/hooks/useSavedPins.ts).

/** The pill's text: the alert's name and its zone, or the empty state's line. */
interface AlertMapPill {
  text: string;
  zone?: string;
  /** A polite status: only while it says there is nothing to show. */
  live: boolean;
}

interface AlertMapProps {
  /** The open alert's id: a new one refits the map. */
  alertId: string | null;
  listings: CarListing[];
  zone?: MapZone;
  pill: AlertMapPill;
  activeId: string | null;
  previewId: string | null;
  onActivate: (listingId: string) => void;
  onPreviewClose: () => void;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (listing: CarListing, next: boolean) => void;
}

export function AlertMap({
  alertId,
  listings,
  zone,
  pill,
  activeId,
  previewId,
  onActivate,
  onPreviewClose,
  favoriteIds,
  onToggleFavorite,
}: AlertMapProps) {
  const t = useTranslations();

  return (
    <SavedMapFrame label={t("alerts.mapLabel")}>
      <ListingsMap
        listings={listings}
        resultsGeneration={alertId ?? undefined}
        zone={zone}
        resetWhenEmpty
        activeId={activeId}
        previewId={previewId}
        onActivate={onActivate}
        onPreviewClose={onPreviewClose}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
      />
      <MapPill text={pill.text} accent={pill.zone} live={pill.live} />
    </SavedMapFrame>
  );
}
