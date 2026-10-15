"use client";

import { useLocale, useTranslations } from "next-intl";
import { PhoneSearchBar } from "@/components/map/phone/PhoneSearchBar";
import { ResultsSheet } from "@/components/map/phone/ResultsSheet";
import { ResultsSkeleton } from "@/components/map/ResultsStates";
import { SheetCardPlaceholder } from "@/components/ui/CardGridSkeleton";
import { DEFAULT_RADIUS_KM } from "@/lib/search/schema";
import { phoneSummary } from "@/lib/search/phone-summary";

// docs/specs/redesign-map.md (MAPUI-30, MAPUI-34); docs/design/canvas/
// F0-estado-cargando.dc.html. /map's own loading state. At desktop width
// (`lg` and up) it is still today's list-column skeleton — the placeholder
// cards the results list shows while its first page loads. Below `lg` it now
// mirrors the map screen itself: the floating search and filters row over a
// plain map surface, and the results sheet in its middle position with the
// «BUSCANDO COCHES…» heading and one placeholder card (MAPUI-30).
//
// A client component, unlike app/favorites/loading.tsx, which is a Server
// Component: it hands PhoneSearchBar and ResultsSheet no-op handlers, and a
// Server Component cannot pass a function to a client one. PhoneSearchBar
// and FilterRow (nested inside it) need no
// other provider, so they render here as the real components, but `inert`:
// every handler is a no-op, since nothing on this static frame opens, and
// nothing on it should be reachable by keyboard or a screen reader either.
// The busy region that carries the status therefore sits outside that inert
// part, as the desktop column's own does (ResultsSkeleton's `label`).
function doNothing() {
  // Nothing on this static frame opens, so every handler below is this one
  // no-op, shared rather than repeated as an empty arrow at each call site.
}

export default function MapLoading() {
  const t = useTranslations();
  const locale = useLocale();
  const summary = phoneSummary({}, null, DEFAULT_RADIUS_KM, { t, locale });

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        data-testid="map-loading-desktop"
        className="hidden w-full px-5 pt-6.5 lg:block lg:w-1/2 lg:px-8 xl:w-207.5"
      >
        <ResultsSkeleton label={t("mapStates.loading")} />
      </div>

      <div aria-busy="true" className="relative isolate min-h-0 flex-1 lg:hidden">
        <span className="sr-only">{t("mapStates.loading")}</span>
        {/* `contents`: this frame is otherwise identical to the live page's,
            laid out by the positioned children below, not by this wrapper —
            `inert` only has to add nothing of its own to that layout. */}
        <div inert className="contents">
          <div aria-hidden="true" className="absolute inset-0 bg-map-ground" />
          <div className="absolute top-float-top right-float-right left-float-left z-500">
            <PhoneSearchBar
              placeSummary={summary.placeSummary}
              carPriceSummary={summary.carPriceSummary}
              input={{}}
              onOpenSearch={doNothing}
              onOpenFilters={doNothing}
              onRemoveChip={doNothing}
            />
          </div>
          <ResultsSheet
            heading={t("mapStates.headingLoading")}
            position="middle"
            onPositionChange={doNothing}
            listings={[]}
            onCreateAlert={doNothing}
            status={<SheetCardPlaceholder />}
          />
        </div>
      </div>
    </div>
  );
}
