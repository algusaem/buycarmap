import type * as React from "react";
import { cn } from "@/lib/utils";

// docs/design/system/components/Chip/README.md: a pill button with
// `aria-pressed`. Pressed fills violet with on-violet text at weight 800 and
// shows no border; unpressed is a 1px line border at weight 600 — the state is
// carried by fill and weight, not colour alone (LOOK-12). The pressed border is
// transparent rather than removed so the chip keeps its size when toggled. The
// pseudo-element keeps a 44px-tall hit area (RULES §19) without changing the
// drawn size.
export function ToggleChip({
  label,
  active,
  onClick,
  ...props
}: {
  label: string;
  active: boolean;
  onClick: () => void;
} & Omit<React.ComponentProps<"button">, "onClick" | "type" | "aria-pressed" | "className">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer whitespace-nowrap rounded-pill border px-4 py-2.25 font-sans text-sm text-text transition-[background-color,border-color,color]",
        "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2",
        active
          ? "border-transparent bg-violet font-extrabold text-on-violet"
          : "border-line font-semibold",
      )}
      {...props}
    >
      {label}
    </button>
  );
}
