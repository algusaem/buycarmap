import type * as React from "react";

import { cn } from "@/lib/utils";

// A generic loading placeholder in the design's loading look
// (docs/design/system/components/EmptyState/README.md › Cargando): bars on
// `surface` with `radius-skeleton-sm`; the price bar takes `surface-strong`
// and `radius-skeleton` through `className`. Shaped by the caller so each
// skeleton mirrors the content it stands in for (RULES.md §19: "skeletons
// mirror final content").
//
// tailwind-merge does not know the design's radius names, so a caller's own
// `rounded-*` would not replace the default one; the default is only added
// when the caller sets none.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  const hasOwnRadius = className?.includes("rounded-") ?? false;

  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse bg-surface", !hasOwnRadius && "rounded-skeleton-sm", className)}
      {...props}
    />
  );
}

export { Skeleton };
