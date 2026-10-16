"use client";

import { AlertsRouteError } from "@/components/alerts/AlertsRouteError";

// PLAT-14 (docs/specs/core-platform.md): a failed read of an alert's page is
// caught here with a retry instead of an empty list (issue #48). Since
// docs/specs/redesign-alerts.md (ALERTUI-42) it is the page-error state beside
// the empty alert map, as /alerts' own.
export default function AlertMatchesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AlertsRouteError error={error} reset={reset} />;
}
