import type * as React from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BusyButtonProps extends React.ComponentProps<typeof Button> {
  /** While a request runs: `aria-disabled`, `aria-busy`, the spinner left of the unchanged label. */
  busy: boolean;
}

/**
 * docs/design/system/components/Button/README.md, the busy state (RULES.md
 * §19: a loading button shows a spinner and keeps its label): at 40%,
 * `aria-disabled` and `aria-busy`, with the loader-circle 10px before the
 * label (docs/specs/redesign-entry.md, ENTRY-13; docs/specs/redesign-pages.md,
 * PAGES-2). It is not natively disabled, so a focused button keeps the focus
 * through its request and after a refusal; a press while busy (a click, or
 * Enter in its form) does nothing, so a second request never starts.
 */
export function BusyButton({
  busy,
  className,
  children,
  onClick,
  "aria-disabled": ariaDisabled,
  ...props
}: BusyButtonProps) {
  return (
    <Button
      aria-disabled={busy || ariaDisabled || undefined}
      aria-busy={busy}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn("gap-2.5 disabled:opacity-40 aria-busy:opacity-40", className)}
      {...props}
    >
      {busy && (
        <LoaderCircle aria-hidden="true" strokeWidth={2.6} className="size-4.5 animate-spin" />
      )}
      {children}
    </Button>
  );
}
