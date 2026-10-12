import type * as React from "react";

import { cn } from "@/lib/utils";

// The design's field (docs/design/system/components/Select/README.md and
// PasswordField/README.md): 52px, radius-field, bg fill, 1px line border that
// turns lime with focus, and 16px text so iOS never zooms (LOOK-13). Focus
// keeps the global lime outline (LOOK-11).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-13 w-full min-w-0 rounded-field border border-line bg-bg px-4 font-sans text-base text-text",
        "placeholder:text-text-muted selection:bg-lime selection:text-on-lime",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text",
        "focus:border-lime aria-invalid:border-danger",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
