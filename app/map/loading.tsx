"use client";

import { useLocale, useTranslations } from "next-intl";
import { PhoneSearchBar } from "@/components/map/phone/PhoneSearchBar";
import { ResultsSheet } from "@/components/map/phone/ResultsSheet";
import { ResultsSkeleton } from "@/components/map/ResultsStates";
import { SheetCardPlaceholder } from "@/components/ui/CardGridSkeleton";
import { DEFAULT_RADIUS_KM } from "@/lib/search/schema";
import { phoneSummary } from "@/lib/search/phone-summary";

// docs/specs/redesign-map.md (MAPUI-30, MAPUI-34, MAPUI-60, MAPUI-62);
// docs/design/canvas/F0-estado-cargando.dc.html. /map's own loading state.
// At desktop width (`lg` and up) it is the list-column skeleton — the
// placeholder cards the results list shows while its first page loads — in
// the list's own place, the left half between the 48px margins. Below `lg` it
// mirrors the map screen itself: the `surface` band with the search summary,
// «Filtros» and the quick filters, and under it a plain map surface with the
// results sheet in its middle position, the «BUSCANDO COCHES…» heading and
// one placeholder card (MAPUI-30).
//
// A client component, unlike app/favorites/loading.tsx, which is a Server
// Component: it hands PhoneSearchBar and ResultsSheet no-op handlers, and a
// Server Component cannot pass a function to a client one. PhoneSearchBar
// and the quick filters (nested inside it) need no other provider, so they
// render here as the real components, but `inert`: every handler is a no-op,
// since nothing on this static frame opens, and nothing on it should be
// reachable by keyboard or a screen reader either. The busy region that
// carries the status therefore sits outside that inert part, as the desktop
// column's own does (ResultsSkeleton's `label`).
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
        className="hidden w-full px-5 pt-6.5 lg:block lg:w-1/2 lg:pt-6 lg:pr-6 lg:pl-12"
      >
        <ResultsSkeleton label={t("mapStates.loading")} />
      </div>

      <div aria-busy="true" className="relative isolate flex min-h-0 flex-1 flex-col lg:hidden">
        <span className="sr-only">{t("mapStates.loading")}</span>
        {/* `contents`: this frame is otherwise identical to the live page's,
            laid out by the children below, not by this wrapper — `inert`
            only has to add nothing of its own to that layout. */}
        <div inert className="contents">
          <div className="shrink-0 bg-surface pt-band-top pb-3">
            <PhoneSearchBar
              placeSummary={summary.placeSummary}
              carPriceSummary={summary.carPriceSummary}
              input={{}}
              onOpenSearch={doNothing}
              onOpenFilters={doNothing}
              onApplyQuick={doNothing}
            />
          </div>
          <div className="relative min-h-0 flex-1">
            <div aria-hidden="true" className="absolute inset-0 bg-map-ground" />
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
    </div>
  );
}
