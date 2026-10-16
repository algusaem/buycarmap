import { useTranslations } from "next-intl";
import { AlertsHeading } from "@/components/alerts/AlertsHeading";
import { SavedColumn, SavedMapFrame } from "@/components/favorites/SavedLayout";
import {
  keys,
  SavedCardPlaceholder,
  SavedRowPlaceholder,
} from "@/components/favorites/SavedPlaceholders";
import { MapPill } from "@/components/map/ResultsStates";
import { BackLink } from "@/components/nav/HeaderParts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// docs/specs/redesign-alerts.md (ALERTUI-38, ALERTUI-39; amends FRONT-14);
// F6-alertas-escritorio › Cargando and F6-alerta-mas-estados. The two alert
// routes while they load, shaped like what they stand for: on /alerts the
// folded AlertCard (the name and the badge on one row, the criteria and the
// date) and the phone AlertCard (the name and the badge, the criteria), in
// `surface-strong` bars since the card is `surface`; on /alerts/[id] the
// heading's bars, the zone's 180px gap and the compact rows on the phone,
// and the Guardados cards on desktop. No card is open and the map has no zone
// and no pin, only the pill «Cargando…», a polite status. The placeholders
// are one `aria-busy` region; at phone width it holds a visually hidden
// «Cargando…» in a polite status instead. Both compositions are drawn and CSS
// breakpoints pick one, so nothing waits on the client's media queries.

const COUNTS = { cards: 4, rows: 3, gridCards: 6 };

/** The criteria bars' widths, one per placeholder, as the board varies them. */
const CRITERIA_WIDTHS = ["w-31/50", "w-7/10", "w-12/25", "w-14/25"];
const NAME_WIDTHS = ["w-17/50", "w-13/50", "w-3/10", "w-19/50"];

function LoadingStatus() {
  const t = useTranslations();
  return (
    <span role="status" className="sr-only">
      {t("map.loading")}
    </span>
  );
}

function LoadingMap() {
  const t = useTranslations();
  return (
    <SavedMapFrame label={t("alerts.mapLabel")}>
      <MapPill text={t("map.loading")} live />
    </SavedMapFrame>
  );
}

interface AlertCardPlaceholderProps {
  /** Its place in the list, for the bars' widths. */
  index: number;
  /** The phone card: 16px of padding and 10px gaps, and no date. */
  phone?: boolean;
}

/** A folded AlertCard's shape: the name and the badge on one row, the criteria, and the date on desktop. */
function AlertCardPlaceholder({ index, phone = false }: AlertCardPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col rounded-card border border-line bg-surface",
        phone ? "gap-2.5 p-4" : "gap-3 px-5 py-4.5",
      )}
    >
      <div className={cn("flex items-center justify-between", phone ? "gap-2" : "gap-2.5")}>
        <Skeleton
          className={cn(
            "rounded-skeleton-sm bg-surface-strong",
            phone ? "h-4" : "h-4.5",
            NAME_WIDTHS[index],
          )}
        />
        <Skeleton className="h-7.5 w-30 rounded-pill bg-surface-strong" />
      </div>
      <Skeleton
        className={cn("h-3.5 rounded-skeleton-sm bg-surface-strong", CRITERIA_WIDTHS[index])}
      />
      {!phone && <Skeleton className="h-3.25 w-11/50 rounded-skeleton-sm bg-surface-strong" />}
    </div>
  );
}

/** /alerts while it loads (app/alerts/loading.tsx, and the page until the client's media queries resolve). */
export function AlertsPagePlaceholder() {
  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn>
        <div className="flex flex-col gap-3.5 lg:gap-5">
          <AlertsHeading />
          <div aria-busy="true">
            <div data-testid="alerts-loading-phone" className="flex flex-col gap-3.5 lg:hidden">
              <LoadingStatus />
              {keys(COUNTS.cards).map((key, index) => (
                <AlertCardPlaceholder key={key} index={index} phone />
              ))}
            </div>
            <div data-testid="alerts-loading-desktop" className="hidden flex-col gap-5 lg:flex">
              {keys(COUNTS.cards).map((key, index) => (
                <AlertCardPlaceholder key={key} index={index} />
              ))}
            </div>
          </div>
        </div>
      </SavedColumn>
      <LoadingMap />
    </div>
  );
}

/** /alerts/[id] while it loads (app/alerts/[id]/loading.tsx, and the page until the client's media queries resolve). */
export function AlertPagePlaceholder() {
  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn>
        <div aria-busy="true">
          <div data-testid="alert-loading-phone" className="flex flex-col gap-3.5 lg:hidden">
            <LoadingStatus />
            <Skeleton className="h-8.5 w-3/5 rounded-skeleton" />
            <Skeleton className="h-7.5 w-7/10 rounded-pill" />
            <Skeleton className="h-3.25 w-2/5" />
            <div className="h-45 w-full shrink-0 rounded-card bg-surface" />
            <Skeleton className="mt-2.5 h-3 w-1/4" />
            {keys(COUNTS.rows).map((key) => (
              <div key={key} data-testid="alert-loading-row" aria-hidden="true">
                <SavedRowPlaceholder />
              </div>
            ))}
          </div>
          <div data-testid="alert-loading-desktop" className="hidden flex-col gap-5 lg:flex">
            <div className="flex items-center gap-4">
              <BackLink href="/alerts" />
              <Skeleton className="h-9 w-1/2 rounded-skeleton" />
            </div>
            <Skeleton className="h-7.5 w-7/10 rounded-pill" />
            <Skeleton className="h-3.25 w-1/4" />
            <Skeleton className="mt-2.5 h-3 w-1/5" />
            <div
              data-testid="alert-loading-grid"
              className="grid gap-x-5 gap-y-7 lg:grid-cols-2 xl:grid-cols-3"
            >
              {keys(COUNTS.gridCards).map((key) => (
                <SavedCardPlaceholder key={key} />
              ))}
            </div>
          </div>
        </div>
      </SavedColumn>
      <LoadingMap />
    </div>
  );
}
