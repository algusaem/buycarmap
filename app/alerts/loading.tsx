import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_COUNT = 4;
const PLACEHOLDER_KEYS = Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => `row-${index}`);

// FRONT-14 (docs/specs/core-frontend.md): /alerts' loading state — a
// skeleton mirroring AlertsList's populated row list (RULES.md §19), rather
// than the card grid the other two routes use. Synchronous, not an async
// Server Component: see app/favorites/loading.tsx's comment.
export default function AlertsLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      {PLACEHOLDER_KEYS.map((key) => (
        <div
          key={key}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
