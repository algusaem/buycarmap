"use client";

import { Fragment, startTransition, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FoldedAlertCard, OpenAlertCard, PhoneAlertCard } from "@/components/alerts/AlertCard";
import { AlertMap } from "@/components/alerts/AlertMap";
import { AlertsHeading } from "@/components/alerts/AlertsHeading";
import { AlertsPagePlaceholder } from "@/components/alerts/AlertPlaceholders";
import { DeleteAlertConfirm } from "@/components/alerts/DeleteAlertConfirm";
import { confirmWithToast, toggleWithToast } from "@/components/alerts/feedback";
import { SavedColumn } from "@/components/favorites/SavedLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AlertsPageData } from "@/interfaces/alert";
import type { CarListing } from "@/interfaces/listing";
import { takeArrivalFocus, useAlertDelete } from "@/lib/hooks/useAlertDelete";
import { useAlertLabels } from "@/lib/hooks/useAlertLabels";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useMatchFavorites } from "@/lib/hooks/useMatchFavorites";
import { useOpenAlert } from "@/lib/hooks/useOpenAlert";
import { useClientResolved, useColumnScroll } from "@/lib/hooks/useSavedList";
import { NO_IDS, useSavedPins } from "@/lib/hooks/useSavedPins";
import { alertMapZone } from "@/lib/map/zone";

// docs/specs/redesign-alerts.md (ALERTUI-1 to ALERTUI-19, ALERTUI-33 to
// ALERTUI-36, ALERTUI-40, ALERTUI-41, ALERTUI-56, ALERTUI-57); R3-alertas, F6-alertas-escritorio and
// F0-estado-alertas-vacio. /alerts under its route frame. At desktop width:
// «Alertas» with «Nueva alerta» and the line, the AlertCards newest first —
// the open one with its chips and newest matches, the others folded to one
// line — and beside them the alert map with the open alert's zone, pill and
// pins. Which alert is open is the server's answer to the URL's `alert`
// (ALERTUI-12): pressing a folded card writes it, and the alert open before
// stays open until the server's next data arrives, when the focus moves to
// the card the press opened (ALERTUI-57). At phone width: the
// heading and one link per alert to its page, whatever `alert` says
// (ALERTUI-13).
//
// A confirmed delete takes the alert out of the list at once, its card with it
// (the list never animates, MOTION-9), and the server's next data has it gone: the URL loses
// `alert`, or the route is read again. Until that data arrives the card open
// in its place shows its matches' placeholders, and the map waits to fit it.
// The focus goes to «Alertas» (ALERTUI-35). The failures come back from the
// hooks as copy and are toasted here (FRONT-15, ./feedback.ts).
//
// The composition switches by media query, as /favorites does: until the
// client has read it (the server render and hydration) the page draws its
// loading placeholders, whose two compositions CSS picks between, so a phone
// never paints the desktop cards first.

/** How an alert is drawn: the phone link, or on desktop the open card or a folded one. */
function cardVariant(isPhone: boolean, isOpen: boolean): "phone" | "open" | "folded" {
  if (isPhone) return "phone";
  return isOpen ? "open" : "folded";
}

export function AlertsPage({ alerts, openAlertId, matches }: AlertsPageData) {
  const t = useTranslations();
  const router = useRouter();
  const isPhone = useIsPhone();
  const resolved = useClientResolved();
  const labels = useAlertLabels();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(NO_IDS);
  const listed = alerts.filter((alert) => !deletedIds.has(alert.id));
  const open = listed.find((alert) => alert.id === openAlertId) ?? listed[0];
  // The matches the server read are the open alert's only while that alert is
  // still the one it resolved; after a delete the next one's are on their way.
  const synced = open !== undefined && open.id === openAlertId;
  const openMatches = synced ? matches : [];
  const { openAlert, clearAfterDelete } = useOpenAlert(listed[0]?.id ?? null);
  const pins = useSavedPins(openMatches, open?.id ?? null);
  const { favoriteIds, toggleSaved } = useMatchFavorites();
  const remove = useAlertDelete();
  // ALERTUI-56: Back to /alerts restores the list column's scroll.
  const column = useColumnScroll(resolved);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // ALERTUI-57: the alert a press asked to open, whose card takes the focus
  // once it is the open one; never on a first load, on Back or after a delete.
  const [pressedId, setPressedId] = useState<string | null>(null);
  // The name of the alert the confirmation was opened for, kept while it fades
  // out after the server's next data no longer lists that alert.
  const confirmNameRef = useRef("");

  // ALERTUI-35: arriving here from a deleted alert's page, the heading takes
  // the focus as it mounts.
  const heading = useCallback((element: HTMLHeadingElement | null) => {
    headingRef.current = element;
    if (element && takeArrivalFocus()) element.focus();
  }, []);

  const focusOpened = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.focus();
    setPressedId(null);
  }, []);

  function handleOpen(alertId: string) {
    setPressedId(alertId);
    column.carryScroll();
    openAlert(alertId);
  }

  const handleToggleFavorite = (listing: CarListing, next: boolean) =>
    void toggleWithToast(toggleSaved, listing, next);

  async function handleConfirm() {
    const deleted = await confirmWithToast(remove.confirm);
    if (!deleted) return;
    setDeletedIds((current) => new Set([...current, deleted]));
    setPressedId(null);
    remove.returnFocusRef.current = headingRef.current;
    remove.close();
    if (!clearAfterDelete()) startTransition(() => router.refresh());
  }

  if (!resolved) return <AlertsPagePlaceholder />;

  const empty = listed.length === 0;
  // The zone is drawn and fitted with the open alert's pins, once its matches
  // have arrived (ALERTUI-16): after a delete, not on its own before.
  const zone = synced ? alertMapZone(open.criteria) : undefined;
  // Read from every alert the server sent, the one being deleted included.
  const confirmName =
    alerts.find((alert) => alert.id === remove.alertId)?.label ?? confirmNameRef.current;

  return (
    <div className="flex min-h-0 flex-1">
      <SavedColumn ref={column.scrollerRef} onScroll={column.recordScroll}>
        <div className="flex flex-col gap-3.5 lg:gap-5">
          <AlertsHeading headingRef={heading} phone={isPhone} />
          {empty && (
            <div className="mt-4.5 lg:mt-14">
              <EmptyState
                question={t("alerts.emptyTitle")}
                punchline={t("alerts.emptyPunchline")}
                line={isPhone ? t("alerts.emptyLinePhone") : t("alerts.emptyLine")}
              >
                <Button asChild variant="primary" size="48">
                  <Link href="/map">{t("alerts.emptyCta")}</Link>
                </Button>
              </EmptyState>
            </div>
          )}
          {!empty &&
            listed.map((alert) => {
              const variant = cardVariant(isPhone, alert.id === open?.id);
              return (
                <Fragment key={alert.id}>
                  {variant === "phone" && <PhoneAlertCard alert={alert} />}
                  {variant === "folded" && (
                    <FoldedAlertCard alert={alert} onOpen={() => handleOpen(alert.id)} />
                  )}
                  {variant === "open" && (
                    <OpenAlertCard
                      alert={alert}
                      matches={openMatches}
                      pending={!synced}
                      activeIds={pins.activeIds}
                      onActiveChange={pins.setHoverId}
                      onDelete={(opener) => {
                        confirmNameRef.current = alert.label;
                        remove.ask(alert.id, opener);
                      }}
                      articleRef={alert.id === pressedId ? focusOpened : undefined}
                    />
                  )}
                </Fragment>
              );
            })}
        </div>
      </SavedColumn>

      {!isPhone && (
        <AlertMap
          // Fitted once the open alert's matches have arrived (ALERTUI-16).
          alertId={synced ? open.id : null}
          listings={openMatches}
          zone={zone}
          pill={
            open
              ? { text: open.label, zone: labels.zone(open), live: false }
              : { text: t("alerts.mapEmpty"), live: true }
          }
          activeId={pins.activeId}
          previewId={pins.previewId}
          onActivate={pins.activatePin}
          onPreviewClose={pins.closePreview}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      <DeleteAlertConfirm
        open={remove.open}
        name={confirmName}
        // The phone /alerts has no «Eliminar» (ALERTUI-28): only the desktop dialog opens here.
        isPhone={false}
        deleting={remove.deleting}
        returnFocusRef={remove.returnFocusRef}
        onCancel={remove.cancel}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
