import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CardGridSkeletonProps {
  count?: number;
  className?: string;
  /** The loading region's accessible name, for a route with no other way to read it (MAP-20). */
  label?: string;
}

export const DEFAULT_COUNT = 6;

interface CardPlaceholderProps {
  className?: string;
}

/**
 * One placeholder shaped like the car card (components/map/CarCard.tsx,
 * MAPUI-30, MAPUI-38): the photo — 250px tall on a phone, 20:19 from `lg` —
 * the name and meta bars, and the price bar in `surface-strong`. The map's
 * results (components/map/ResultsStates.tsx) compose this directly for the
 * desktop grid, rather than through `CardGridSkeleton`, since below `lg` it
 * shows `SheetCardPlaceholder` instead (MAPUI-30).
 */
export function CardPlaceholder({ className }: CardPlaceholderProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="h-62.5 rounded-card bg-surface-strong lg:aspect-20/19 lg:h-auto lg:bg-surface" />
      <Skeleton className="h-4 w-3/4 bg-surface-strong lg:bg-surface" />
      <Skeleton className="h-4 w-1/2 bg-surface-strong lg:bg-surface" />
      <Skeleton className="h-5.5 w-1/3 rounded-skeleton bg-surface-strong" />
    </div>
  );
}

/**
 * The results sheet's one placeholder card while the route itself is still
 * loading (`F0-estado-cargando.dc.html`): the photo plus two bars, 70% × 16px
 * and 45% × 22px, rather than `CardPlaceholder`'s three (this sheet shows no
 * price bar of its own in the design). 70% and 45% are not widths the
 * spacing scale offers; `w-2/3` (66.67%) and `w-5/12` (41.67%) are the
 * closest existing fractions. Used below `lg` by both `/map`'s own loading
 * route (app/map/loading.tsx) and the map's live results (MAPUI-30).
 */
export function SheetCardPlaceholder() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="h-62.5 rounded-card bg-surface-strong" />
      <Skeleton className="h-4 w-2/3 bg-surface-strong" />
      <Skeleton className="h-5.5 w-5/12 rounded-skeleton bg-surface-strong" />
    </div>
  );
}

/**
 * FRONT-14 (docs/specs/core-frontend.md): the card-grid loading state of
 * `/alerts/[id]`, whose populated view is a grid of cards, so it mirrors its
 * final content (RULES.md §19) instead of a bare spinner. `/favorites` has its
 * own since SAVED-30 (docs/specs/redesign-saved.md). Each placeholder is the car card's shape
 * (`CardPlaceholder`).
 *
 * MAP-20: the container is `aria-busy`, not `role="status"` — a live region
 * announces every update inside it, and a second one beside a page's own
 * status region is matched twice by `getByRole("status")` under strict mode.
 * `aria-busy` still marks the region as
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
        <CardPlaceholder key={key} />
      ))}
    </div>
  );
}
