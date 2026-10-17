"use client";

import { AlertsRouteError } from "@/components/alerts/AlertsRouteError";

// PLAT-14 (docs/specs/core-platform.md): server/alerts/queries.ts no longer
// swallows a failed read into an empty list (issue #48); this catches it and
// offers a retry instead. Since docs/specs/redesign-alerts.md (ALERTUI-42) it
// is the page-error state beside the empty alert map.
export default function AlertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AlertsRouteError error={error} reset={reset} />;
}
