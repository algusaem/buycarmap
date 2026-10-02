import { Skeleton } from "@/components/ui/skeleton";

interface CardGridSkeletonProps {
  count?: number;
  className?: string;
  /** The loading container's accessible name. Plain text, not a `t.*` lookup —
   * callers own their own copy source; this primitive stays i18n-agnostic. */
  label?: string;
}

const DEFAULT_COUNT = 6;

/**
 * FRONT-14 (docs/specs/core-frontend.md): a card-grid loading state shared by
 * every route whose populated view is a grid of cards — the map's results
 * list, `/favorites` and `/alerts/[id]` — so each mirrors its own final
 * content (RULES.md §19) instead of a bare spinner.
 *
 * MAP-20: the container is `aria-busy`, not `role="status"` — a live region
 * announces every update inside it, and on the map's results list that
 * clashed with LocationSearch's own `role="status"`, which `getByRole("status")`
 * then matched twice under strict mode. `aria-busy` still marks the region as
 * loading for assistive tech (RULES.md §19 "redundant status cues") without
 * claiming the live-region role; the individual placeholders are
 * `aria-hidden` so they are never announced as if they were real cards.
 */
export function CardGridSkeleton({
  count = DEFAULT_COUNT,
  className,
  label,
}: CardGridSkeletonProps) {
  return (
    <div
      aria-busy="true"
      className={className ?? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"}
    >
      {label && <span className="sr-only">{label}</span>}
      {Array.from({ length: count }, (_, index) => `placeholder-${index}`).map((key) => (
        <div key={key} aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
