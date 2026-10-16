import { useTransition } from "react";
import { parseAsString, useQueryState } from "nuqs";

// docs/specs/redesign-alerts.md (ALERTUI-11, ALERTUI-12, ALERTUI-35;
// Contracts › URL): which alert /alerts shows open at desktop width, as the
// URL's `alert`. The newest is the default and writes no parameter
// (`clearOnDefault`); any other writes its id. Each press adds a history entry
// and is not shallow, so the server reads the newly open alert's matches, in
// a transition that keeps the alert open before it on screen until they
// load. Rendering never writes the URL: what `alert` holds is resolved on the
// server (server/alerts/service.ts's resolveOpenAlertId), and the page leaves
// it as it is. After a delete the parameter goes, replacing the entry, so the
// server reads the alerts left.

interface OpenAlert {
  /** Opens `alertId`; the newest writes no `alert` parameter. */
  openAlert: (alertId: string) => void;
  /**
   * An alert was deleted (ALERTUI-35): the URL loses `alert`, replacing the
   * entry, and the server reads the alerts left. False when the URL had no
   * `alert` to lose, so the caller refreshes the route itself.
   */
  clearAfterDelete: () => boolean;
}

export function useOpenAlert(newestId: string | null): OpenAlert {
  const [, startTransition] = useTransition();
  const [requested, setAlert] = useQueryState(
    "alert",
    parseAsString.withOptions({ history: "push", shallow: false, startTransition }),
  );

  return {
    openAlert: (alertId) => void setAlert(alertId === newestId ? null : alertId),
    clearAfterDelete: () => {
      if (requested === null) return false;
      void setAlert(null, { history: "replace" });
      return true;
    },
  };
}
