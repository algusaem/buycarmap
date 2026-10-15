import { CardGridSkeleton } from "@/components/ui/CardGridSkeleton";

// FRONT-14 (docs/specs/core-frontend.md): /alerts/[id]'s loading state — a
// skeleton mirroring AlertMatchesList's populated card grid. Synchronous, not
// an async Server Component reading the locale: its loading.test.tsx renders
// it directly with `render()`, which (unlike Next's own RSC streaming) cannot
// resolve an async component.
export default function AlertMatchesLoading() {
  return <CardGridSkeleton />;
}
