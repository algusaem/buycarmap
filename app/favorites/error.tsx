"use client";

import { RouteError } from "@/components/ui/RouteError";

// PLAT-14 (docs/specs/core-platform.md): server/favorites/queries.ts no
// longer swallows a failed read into an empty list (issue #48); this catches
// it and offers a retry instead.
export default function FavoritesError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError reset={reset} />;
}
