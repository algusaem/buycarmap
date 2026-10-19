import type * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Sizes drawn under 44px keep a 44x44 hit area (RULES §19) without changing
// their drawn size (LOOK-9): an absolutely positioned 44px pseudo-element with
// no insets sits at its static position, which the button's own
// `items-center justify-center` centres over the label. The button is
// deliberately not `relative`: the pseudo-element then belongs to an
// ancestor's containing block, so it never adds to the button's own scroll
// size (a label that wraps is detected that way).
const HIT_AREA = "before:absolute before:size-11";

// The look follows docs/design/system/components/Button/README.md: every
// button is a pill that never wraps its label. Transitions list their
// properties (never `transition-all`); `color` is left out so the undo
// button's hover/focus colour is immediate (LOOK-10). Hover and press move in
// the 120ms state transition app/globals.css sets (MOTION-1, MOTION-4); the
// press scale is off under reduced motion.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill font-sans transition-[background-color,border-color,filter,scale] active:scale-97 motion-reduce:active:scale-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Principal: lime / on-lime, weight 800.
        primary: "bg-lime font-extrabold text-on-lime hover:brightness-108",
        // Secundario: 1px line border, text, weight 700.
        secondary:
          "border border-line font-bold text-text hover:border-text-muted hover:bg-surface",
        // Fantasma: text only, weight 700.
        ghost: "font-bold text-text hover:bg-surface-strong",
        // Deshacer: a ghost whose text turns danger on hover and focus.
        undo: "font-bold text-text hover:text-danger focus-visible:text-danger",
        // Peligro: danger text and a danger border at 60 %, full danger on hover.
        danger: "border border-danger/60 font-bold text-danger hover:border-danger",
        // De icono: round, 1px line border.
        icon: "border border-line text-text hover:bg-surface-strong",
        // Legacy names still used by callers, mapped onto the looks above.
        default: "bg-lime font-extrabold text-on-lime hover:brightness-108",
        outline: "border border-line font-bold text-text hover:border-text-muted hover:bg-surface",
        destructive: "border border-danger/60 font-bold text-danger hover:border-danger",
      },
      size: {
        // 56px full width, button-display: Unbounded uppercase 15px.
        display: "h-14 w-full px-6 font-display text-[15px] uppercase",
        // 54px: padding 0 24px, 7px gap, 16px.
        "54": "h-13.5 gap-1.75 px-6 text-base",
        // 52px, 16px.
        "52": "h-13 px-6 text-base",
        // 48px: padding 0 22px (primary), 15px.
        "48": "h-12 px-5.5 text-[15px]",
        // 44px: padding 0 18px, 14px.
        "44": "h-11 px-4.5 text-sm",
        // 40px: padding 0 16px, 14px (desktop text button, SearchPill's «Crear alerta»).
        "40": "h-10 px-4 text-sm",
        // 42px: padding 0 16px, 14px.
        "42": `h-10.5 px-4 text-sm ${HIT_AREA}`,
        // Small by padding: 11px 20px at 15px, and 10px 16px at 14px.
        "pad-15": `px-5 py-2.75 text-[15px] ${HIT_AREA}`,
        "pad-14": `px-4 py-2.5 text-sm ${HIT_AREA}`,
        // Icon buttons: 42px round, and 40px to close a panel.
        icon: `size-10.5 ${HIT_AREA}`,
        "icon-40": `size-10 ${HIT_AREA}`,
        // Legacy names still used by callers.
        default: "h-12 px-5.5 text-[15px]",
        sm: `px-4 py-2.5 text-sm ${HIT_AREA}`,
        lg: "h-13 px-6 text-base",
        "icon-sm": `size-10 ${HIT_AREA}`,
        "icon-lg": `size-10.5 ${HIT_AREA}`,
      },
    },
    compoundVariants: [
      // Secondary at 48px uses padding 0 20px; the undo ghost 0 14px.
      { variant: ["secondary", "outline"], size: ["48", "default"], className: "px-5" },
      { variant: "undo", size: ["48", "default"], className: "px-3.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
