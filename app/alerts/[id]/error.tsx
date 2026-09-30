"use client";

import { RouteError } from "@/components/ui/RouteError";

// PLAT-14 (docs/specs/core-platform.md): server/alerts/queries.ts's
// findAlertWithMatches read is not swallowed into a fallback state; this
// catches a failed read and offers a retry instead.
export default function AlertMatchesError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError reset={reset} />;
}
