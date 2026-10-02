import { CardGridSkeleton } from "@/components/ui/CardGridSkeleton";

// FRONT-14 (docs/specs/core-frontend.md): /alerts/[id]'s loading state — a
// skeleton mirroring AlertMatchesList's populated card grid. Synchronous, not
// an async Server Component: see app/favorites/loading.tsx's comment.
export default function AlertMatchesLoading() {
  return <CardGridSkeleton />;
}
