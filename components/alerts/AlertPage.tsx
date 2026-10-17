"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CriteriaChips } from "@/components/alerts/AlertCard";
import { AlertMap } from "@/components/alerts/AlertMap";
import { AlertPagePlaceholder } from "@/components/alerts/AlertPlaceholders";
import { AlertZoneMap } from "@/components/alerts/AlertZoneMap";
import { DeleteAlertConfirm } from "@/components/alerts/DeleteAlertConfirm";
import { confirmWithToast, toggleWithToast } from "@/components/alerts/feedback";
import { SavedCarSheet } from "@/components/favorites/SavedCarSheet";
import { SavedColumn } from "@/components/favorites/SavedLayout";
import { SavedList } from "@/components/favorites/SavedList";
import { BackLink } from "@/components/nav/HeaderParts";
import { Button } from "@/components/ui/button";
import type { AlertWithMatches } from "@/interfaces/alert";
import type { CarListing } from "@/interfaces/listing";
import { focusAlertsOnArrival, useAlertDelete } from "@/lib/hooks/useAlertDelete";
import { useAlertLabels } from "@/lib/hooks/useAlertLabels";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useMatchFavorites } from "@/lib/hooks/useMatchFavorites";
import { useSavedCarSheet } from "@/lib/hooks/useSavedCarSheet";
import { useSavedColumns } from "@/lib/hooks/useSavedColumns";
import { useSavedList } from "@/lib/hooks/useSavedList";
import { useSavedPins } from "@/lib/hooks/useSavedPins";
import { alertMapZone } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-14 to ALERTUI-26, ALERTUI-29 to
// ALERTUI-36, ALERTUI-41, ALERTUI-51 to ALERTUI-55); F6-alerta,
// F6-alerta-escritorio, F6-alerta-estados and F6-alerta-mas-estados.
// /alerts/[id] under its route frame: the alert's name, its criteria as
// chips, «Creada el …» and the match count over every match, newest first,
// then «Eliminar alerta». At desktop width «Volver» sits beside the name, the
// matches are Guardados cards whose heart follows the buyer's favorites, and
// the alert map is beside the list. At phone width «Volver» is the header's
// (MAPUI-54), the zone shows over the matches when the alert has a place,
// and the matches are compact rows that open the car sheet. The match list
// is virtualised at both widths with the saved cars' list
// (lib/hooks/useSavedList.ts, ADR 0021). A confirmed delete goes back to
// /alerts, replacing this page's entry so Back never reaches its 404, and the
// list's heading takes the focus there (ALERTUI-35).

/** The compact rows' gap: 86px rows 14px apart, a 100px pitch (F6-alerta-mas-estados, ALERTUI-29). */
const ROW_GAP = 14;

interface AlertPageProps {
  alert: AlertWithMatches;
}

export function AlertPage({ alert }: AlertPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const isPhone = useIsPhone();
  const columns = useSavedColumns();
  const labels = useAlertLabels();
  const { matches } = alert;
  const list = useSavedList({ shown: matches, columns, phoneGap: ROW_GAP });
  const pins = useSavedPins(matches);
  const sheet = useSavedCarSheet();
  const { favoriteIds, toggleSaved } = useMatchFavorites();
  const remove = useAlertDelete();

  const handleToggle = (listing: CarListing, next: boolean) =>
    void toggleWithToast(toggleSaved, listing, next);

  const toggleListing = (listing: CarListing) =>
    handleToggle(listing, !favoriteIds.has(listing.id));

  async function handleConfirm() {
    if (!(await confirmWithToast(remove.confirm))) return;
    focusAlertsOnArrival();
    router.replace("/alerts");
  }

  if (!list.resolved) return <AlertPagePlaceholder />;

  const zone = alertMapZone(alert.criteria);
  const zoneLabel = labels.zone(alert);

  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn ref={list.scrollerRef} onScroll={list.recordScroll}>
        <div className="flex flex-col gap-3.5 lg:gap-5">
          {/* «Volver» beside the name from `lg`; on the phone it is the header's (MAPUI-54). */}
          <div className="min-w-0 lg:flex lg:items-center lg:gap-4">
            {!isPhone && <BackLink href="/alerts" />}
            <h1 className="m-0 min-w-0 font-display text-hero-mobile font-black text-balance wrap-break-word uppercase max-lg:tracking-normal lg:text-alert-title">
              {alert.label}
            </h1>
          </div>
          <CriteriaChips parts={labels.criteria(alert)} />
          <span className="text-small text-text-muted">{labels.createdOn(alert.createdAt)}</span>
          {isPhone && zone && zoneLabel && <AlertZoneMap zone={zone} label={zoneLabel} />}
          <h2 className="m-0 mt-2.5 font-sans text-section-label font-bold uppercase text-text-muted">
            {labels.matchCount(matches.length)}
          </h2>
          {matches.length === 0 && (
            <p className="m-0 text-body-15 text-text-muted">{t("alerts.noMatchesYet")}</p>
          )}
          {matches.length > 0 && (
            <SavedList
              listRef={list.listRef}
              virtualizer={list.virtualizer}
              scrollMargin={list.scrollMargin}
              listings={matches}
              columns={columns}
              activeIds={pins.activeIds}
              onActiveChange={pins.setHoverId}
              savedIds={favoriteIds}
              onToggleSaved={toggleListing}
              rowTail="none"
              onOpen={sheet.openSheet}
              onRowFocus={list.focusRow}
              leaving={list.leaving}
              onLeft={list.leftList}
              arriving={list.arriving}
            />
          )}
          <Button
            type="button"
            variant="danger"
            size="44"
            onClick={(event) => remove.ask(alert.id, event.currentTarget)}
            className="mt-2.5 w-full lg:mt-0 lg:w-auto lg:self-start"
          >
            {t("alerts.delete")}
          </Button>
        </div>
      </SavedColumn>

      {!isPhone && (
        <AlertMap
          alertId={alert.id}
          listings={matches}
          zone={zone}
          pill={{ text: alert.label, zone: zoneLabel, live: false }}
          activeId={pins.activeId}
          previewId={pins.previewId}
          onActivate={(listingId) => list.scrollToCar(pins.activatePin(listingId))}
          onPreviewClose={pins.closePreview}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggle}
        />
      )}

      {isPhone && (
        <SavedCarSheet
          listing={sheet.listing}
          open={sheet.open}
          onClose={sheet.closeSheet}
          saved={sheet.listing !== null && favoriteIds.has(sheet.listing.id)}
          onToggleSaved={toggleListing}
          returnFocusRef={sheet.returnFocusRef}
        />
      )}

      <DeleteAlertConfirm
        open={remove.open}
        name={alert.label}
        isPhone={isPhone}
        deleting={remove.deleting}
        returnFocusRef={remove.returnFocusRef}
        onCancel={remove.cancel}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
