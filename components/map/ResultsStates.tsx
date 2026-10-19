"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RESULTS_GRID_CLASS } from "@/components/map/results-grid";
import {
  CardPlaceholder,
  DEFAULT_COUNT,
  SheetCardPlaceholder,
} from "@/components/ui/CardGridSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import type { ResultsState } from "@/lib/map/results-state";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-30 to MAPUI-32);
// docs/design/system/components/EmptyState/README.md and StatusPill/README.md.
// The map results' loading, empty and error states, and the status pill over
// the desktop map that says which one is showing. None of them animates: they
// sit in the results list and over it, the surfaces a buyer sees most
// (MOTION-8).

interface ResultsSkeletonProps {
  /** The loading region's accessible name. `/map`'s own loading file
   * (app/map/loading.tsx) is a client component and reads it from
   * `useTranslations` like this one does; a server one would have no
   * messages to pass instead. */
  label?: string;
}

/**
 * The map results' loading placeholder (MAPUI-30), one `aria-busy` region
 * for both widths: below `lg`, the phone sheet's one placeholder
 * (`SheetCardPlaceholder`, `F0-estado-cargando.dc.html` — the photo plus two
 * bars, since the sheet draws no price bar of its own); from `lg`, the
 * desktop grid of `CardPlaceholder`s (the photo plus three bars). `aria-busy`,
 * not `role="status"`: the status pill over the map is the one live region.
 */
export function ResultsSkeleton({ label }: ResultsSkeletonProps) {
  return (
    <div aria-busy="true">
      {label && <span className="sr-only">{label}</span>}
      <div className="lg:hidden">
        <SheetCardPlaceholder />
      </div>
      <div className={cn(RESULTS_GRID_CLASS, "max-lg:hidden")}>
        {Array.from({ length: DEFAULT_COUNT }, (_, index) => `placeholder-${index}`).map((key) => (
          <CardPlaceholder key={key} />
        ))}
      </div>
    </div>
  );
}

interface ResultsStatusProps {
  state: Exclude<ResultsState, "ready">;
  /** The radius to widen to, or none without a place or at 200 km. */
  widenTo?: number;
  radiusKm: number;
  /** Whether any filter is active beyond the place and its radius (MAPUI-31). */
  hasFilters: boolean;
  onRetry: () => void;
  onWiden: () => void;
  onClearFilters: () => void;
  /** «Toda España»: clears the place for a national search (MAPUI-5, MAPUI-31). */
  onAllSpain: () => void;
}

/** What the list shows in place of the cards while it has none to show, switching from one state to the next at once. */
export function ResultsStatus({ state, onRetry, ...noResults }: ResultsStatusProps) {
  const t = useTranslations();

  return (
    <>
      {state === "loading" && <ResultsSkeleton label={t("mapStates.loading")} />}
      {state === "error" && <SearchError onRetry={onRetry} />}
      {state === "empty" && <NoResults {...noResults} />}
    </>
  );
}

interface ResultsEmptyStateProps {
  question: string;
  punchline: string;
  line: string;
  children: ReactNode;
}

/** The `pt-4.5 lg:pt-14` EmptyState wrapper NoResultsNoFilters, NoResultsFiltered and SearchError all share. */
function ResultsEmptyState({ question, punchline, line, children }: ResultsEmptyStateProps) {
  return (
    <div className="pt-4.5 lg:pt-14">
      <EmptyState question={question} punchline={punchline} line={line}>
        {children}
      </EmptyState>
    </div>
  );
}

type NoResultsProps = Omit<ResultsStatusProps, "state" | "onRetry">;

/**
 * «¿Nada por aquí?» (MAPUI-31). With a filter active: over «Amplía el radio»
 * with «Ampliar a…» and «Quitar filtros», or over «Quita algún filtro» when
 * there is no radius to widen. With none, only the place and its radius:
 * over «Amplía el radio», with «Ampliar a…» or, at 200 km, «Toda España».
 */
function NoResults({
  widenTo,
  radiusKm,
  hasFilters,
  onWiden,
  onClearFilters,
  onAllSpain,
}: NoResultsProps) {
  if (!hasFilters)
    return (
      <NoResultsNoFilters
        widenTo={widenTo}
        radiusKm={radiusKm}
        onWiden={onWiden}
        onAllSpain={onAllSpain}
      />
    );
  return (
    <NoResultsFiltered
      widenTo={widenTo}
      radiusKm={radiusKm}
      onWiden={onWiden}
      onClearFilters={onClearFilters}
    />
  );
}

type NoResultsNoFiltersProps = Pick<
  NoResultsProps,
  "widenTo" | "radiusKm" | "onWiden" | "onAllSpain"
>;

/** Only the place and its radius: widen it, or search all of Spain from 200 km. */
function NoResultsNoFilters({ widenTo, radiusKm, onWiden, onAllSpain }: NoResultsNoFiltersProps) {
  const t = useTranslations();

  return (
    <ResultsEmptyState
      question={t("mapStates.emptyTitle")}
      punchline={t("mapStates.emptyWiden")}
      line={t("mapStates.emptyLineNoFilters", { km: radiusKm })}
    >
      {widenTo !== undefined && (
        <Button type="button" variant="primary" size="48" onClick={onWiden}>
          {t("mapStates.widenTo", { km: widenTo })}
        </Button>
      )}
      {widenTo === undefined && (
        <Button type="button" variant="primary" size="48" onClick={onAllSpain}>
          {t("mapStates.widenAllSpain")}
        </Button>
      )}
    </ResultsEmptyState>
  );
}

type NoResultsFilteredProps = Pick<
  NoResultsProps,
  "widenTo" | "radiusKm" | "onWiden" | "onClearFilters"
>;

function NoResultsFiltered({ widenTo, radiusKm, onWiden, onClearFilters }: NoResultsFilteredProps) {
  const t = useTranslations();
  const canWiden = widenTo !== undefined;

  return (
    <ResultsEmptyState
      question={t("mapStates.emptyTitle")}
      punchline={canWiden ? t("mapStates.emptyWiden") : t("mapStates.emptyRemove")}
      line={canWiden ? t("mapStates.emptyLineRadius", { km: radiusKm }) : t("mapStates.emptyLine")}
    >
      {canWiden && (
        <Button type="button" variant="primary" size="48" onClick={onWiden}>
          {t("mapStates.widenTo", { km: widenTo })}
        </Button>
      )}
      <Button
        type="button"
        variant={canWiden ? "undo" : "primary"}
        size="48"
        onClick={onClearFilters}
      >
        {t("mapStates.clearFilters")}
      </Button>
    </ResultsEmptyState>
  );
}

interface SearchErrorProps {
  onRetry: () => void;
}

/** «¿Se ha caído algo?» over «Prueba otra vez», with «Reintentar» (MAPUI-32). */
function SearchError({ onRetry }: SearchErrorProps) {
  const t = useTranslations();

  return (
    <ResultsEmptyState
      question={t("mapStates.errorTitle")}
      punchline={t("mapStates.errorRetry")}
      line={t("mapStates.errorLine")}
    >
      <Button type="button" variant="primary" size="48" onClick={onRetry}>
        {t("mapStates.retry")}
      </Button>
    </ResultsEmptyState>
  );
}

interface StatusPillProps {
  state: ResultsState;
  radiusKm: number;
  canWiden: boolean;
  hasFilters: boolean;
}

/**
 * The pill at the desktop map's top left (MAPUI-30 to MAPUI-32): mounted
 * all along as the polite live region, drawn only while there is something to
 * say. On a phone the state shows in the results sheet instead.
 */
export function StatusPill({ state, radiusKm, canWiden, hasFilters }: StatusPillProps) {
  const t = useTranslations();
  let text: string | undefined;
  if (state === "loading") text = t("mapStates.loading");
  if (state === "error") text = t("mapStates.statusError");
  // With a filter and no radius to widen, the pill names none; with no
  // filter it always names the radius, 200 km included (MAPUI-31).
  if (state === "empty") {
    text =
      canWiden || !hasFilters
        ? t("mapStates.statusNoneRadius", { km: radiusKm })
        : t("mapStates.statusNone");
  }

  return <MapPill text={text} live />;
}

interface MapPillProps {
  /** What the pill says; none draws no pill. */
  text: string | undefined;
  /** A second part after « · », in lime: an alert's zone (AlertZone/README.md). */
  accent?: string;
  /** Whether it is a polite live region (`role="status"`). */
  live: boolean;
}

/**
 * The pill at the top left of a desktop map (StatusPill/README.md), switching
 * from one text to the next at once: /map's status (StatusPill), the saved
 * map's title, which is a status only while it says there is nothing to show
 * (docs/specs/redesign-saved.md, SAVED-13), and the alert map's name and zone
 * (docs/specs/redesign-alerts.md, ALERTUI-15).
 */
export function MapPill({ text, accent, live }: MapPillProps) {
  return (
    <div
      role={live ? "status" : undefined}
      // The same inset on the right as on the left, so the pill inside, as wide
      // as its text up to this strip, is cut to one line with «…» rather than
      // run past the map's edge. The strip lets the map take the presses
      // around the pill.
      className="pointer-events-none absolute top-4.5 right-4.5 left-4.5 z-1000 max-lg:hidden"
    >
      {text && (
        <span className="pointer-events-auto block w-fit max-w-full truncate rounded-pill border border-line bg-surface px-4 py-2.5 text-sm font-bold text-text">
          {text}
          {accent && (
            <>
              {" · "}
              <span className="text-lime">{accent}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}

interface LoadingMoreProps {
  loading: boolean;
}

/** «Cargando…» under the list while the next page loads (MAP-8), shown and removed at once. */
export function LoadingMore({ loading }: LoadingMoreProps) {
  const t = useTranslations();

  if (!loading) return null;
  return (
    <div className="flex items-center gap-2">
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-lime" />
      <span className="text-sm text-text-muted">{t("map.loading")}</span>
    </div>
  );
}
