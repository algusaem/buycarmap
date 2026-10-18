import type * as React from "react";
import { cn } from "@/lib/utils";

// docs/design/system/components/Chip/README.md: a pill button with
// `aria-pressed`. Pressed fills violet with on-violet text and shows no
// border; unpressed is a 1px line border. The pressed border is transparent
// rather than removed so the chip keeps its size when toggled. The
// pseudo-element keeps a 44px-tall hit area (RULES §19) without changing the
// drawn size.
//
// Two sizes, both weight 800 pressed and 600 unpressed — the state is
// carried by fill and weight, not colour alone (LOOK-12), the same for every
// size. `default`, the filters panel's: 14px. `quick`, the quick filters'
// (docs/specs/redesign-map.md MAPUI-63): 34px tall, 13px, the state also
// carried by the fill and the border.
const SIZES = {
  default: "px-4 py-2.25 text-sm",
  quick: "flex h-8.5 shrink-0 items-center px-3.5 text-small",
} satisfies Record<string, string>;

export function ToggleChip({
  label,
  active,
  onClick,
  size = "default",
  ...props
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  size?: keyof typeof SIZES;
} & Omit<React.ComponentProps<"button">, "onClick" | "type" | "aria-pressed" | "className">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer whitespace-nowrap rounded-pill border font-sans text-text transition-[background-color,border-color,color]",
        "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2",
        SIZES[size],
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
