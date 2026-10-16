import { useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useMessages, useTranslations } from "next-intl";
import { translateError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { deleteAlert } from "@/server/alerts/actions";

// docs/specs/redesign-alerts.md (ALERTUI-33 to ALERTUI-36; worked example
// "Delete"): deleting an alert behind its confirmation. The confirmation's
// state, the control the focus goes back to when it closes, and the request:
// one at a time, with «Eliminar» busy while it runs. A refused or thrown
// delete closes the confirmation, leaves everything as it was and resolves to
// the failure's copy for the caller to toast (FRONT-15). A delete that
// succeeded is the caller's to follow: /alerts lists the alert no more,
// /alerts/[id] goes back to /alerts.

/**
 * How long the heading's focus waits for /alerts to mount after a delete on an
 * alert's page: one navigation. Past it the mark is dropped, so a later,
 * unrelated visit to /alerts never moves the focus.
 */
export const ARRIVAL_FOCUS_MS = 10_000;

/**
 * Set when a delete leaves an alert's page for /alerts, so the list's heading
 * takes the focus when it mounts there (ALERTUI-35). Module state, as the
 * client-side navigation it survives keeps the module loaded; the timer drops
 * it when /alerts does not mount in time (it failed, or the user went
 * elsewhere).
 */
let headingFocusOnArrival = false;
let arrivalTimer: ReturnType<typeof setTimeout> | undefined;

function clearArrival(): void {
  headingFocusOnArrival = false;
  clearTimeout(arrivalTimer);
  arrivalTimer = undefined;
}

/** Whether /alerts' heading should take the focus as it mounts: once, after a delete on an alert's page. */
export function takeArrivalFocus(): boolean {
  const pending = headingFocusOnArrival;
  clearArrival();
  return pending;
}

/** A delete on an alert's page succeeded: /alerts' heading takes the focus when it mounts, within one navigation. */
export function focusAlertsOnArrival(): void {
  clearArrival();
  headingFocusOnArrival = true;
  arrivalTimer = setTimeout(clearArrival, ARRIVAL_FOCUS_MS);
}

/** How a confirmed delete ended: the alert gone, or the failure's copy. */
type DeleteOutcome = { deleted: string } | { failure: string };

export function useAlertDelete() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [alertId, setAlertId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The control that opened the confirmation, where the focus returns when it
  // closes; after a delete on /alerts, the page's heading instead.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const inFlightRef = useRef(false);

  /** Closes the confirmation and frees the next delete. */
  function close() {
    inFlightRef.current = false;
    setDeleting(false);
    setOpen(false);
  }

  function fail(failure: string): DeleteOutcome {
    close();
    return { failure };
  }

  return {
    open,
    deleting,
    /** The alert the confirmation was opened for, whose name its title quotes. */
    alertId,
    returnFocusRef,
    /** Opens the confirmation for `id`, from `opener`. */
    ask: (id: string, opener: HTMLElement) => {
      returnFocusRef.current = opener;
      setAlertId(id);
      setOpen(true);
    },
    /** «Cancelar», Escape, a press outside or a drag: nothing is sent. Ignored while the delete runs. */
    cancel: () => {
      if (!inFlightRef.current) setOpen(false);
    },
    /** Closes the confirmation once a delete has been followed (/alerts). */
    close,
    /** «Eliminar»: deletes the alert once, whatever the presses. */
    confirm: async (): Promise<DeleteOutcome | null> => {
      if (!alertId || inFlightRef.current) return null;
      inFlightRef.current = true;
      setDeleting(true);
      try {
        const result = await deleteAlert(alertId);
        if (!result.ok) return fail(translateError(messages, result.error.messageKey));
        return { deleted: alertId };
      } catch (error) {
        // An unexpected failure (PLAT-12): reported, and the generic copy.
        Sentry.captureException(error);
        return fail(t("alertErrors.unexpected"));
      }
    },
  };
}
