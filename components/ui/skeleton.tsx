import type * as React from "react";

import { cn } from "@/lib/utils";

// A generic loading placeholder, built only from the theme's existing
// `muted` token (RULES.md §17: no new colours or visual patterns). Shaped by
// the caller via `className` so each skeleton mirrors the content it stands
// in for (RULES.md §19: "skeletons mirror final content").
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
