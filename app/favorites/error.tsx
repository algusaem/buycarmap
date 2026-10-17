"use client";

import { SavedRouteError } from "@/components/favorites/SavedLayout";

// PLAT-14 (docs/specs/core-platform.md): server/favorites/queries.ts no
// longer swallows a failed read into an empty list (issue #48); this catches
// it and offers a retry instead. Since docs/specs/redesign-saved.md (SAVED-32)
// it is the page-error state (components/ui/PageError.tsx) with the shared
// line and «Volver al mapa», in the page's list column. At desktop width the
// empty map sits beside it, with no pill; below `lg` CSS hides it.
interface FavoritesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FavoritesError({ error, reset }: FavoritesErrorProps) {
  return <SavedRouteError error={error} reset={reset} />;
}
