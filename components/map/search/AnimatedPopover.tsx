"use client";

import type { ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence } from "motion/react";
import { PopoverCard } from "./PopoverCard";

// docs/specs/redesign-map.md (MAPUI-2); docs/design/system/components/
// SearchPopover/README.md. The Radix popover frame SearchPill's segments,
// its «Crear alerta» button and FilterRow's «Filtros» all open the same way:
// `Root` → `AnimatePresence` → `Portal forceMount` → `Content forceMount
// asChild` → `PopoverCard`. `open` alone governs the Radix root (so a caller
// can keep it open with no content yet, as SearchPill's segments do); the
// card itself mounts only once there is `content` to show.
interface AnimatedPopoverProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rendered through `PopoverPrimitive.Trigger asChild`. */
  trigger: ReactNode;
  content: ReactNode;
  ariaLabel: string;
  align: "start" | "end";
  sideOffset: number;
  collisionPadding?: number;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  className: string;
}

export function AnimatedPopover({
  open,
  onOpenChange,
  trigger,
  content,
  ariaLabel,
  align,
  sideOffset,
  collisionPadding,
  onEscapeKeyDown,
  className,
}: AnimatedPopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <AnimatePresence>
        {open && content && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              forceMount
              asChild
              aria-label={ariaLabel}
              onEscapeKeyDown={onEscapeKeyDown}
              align={align}
              sideOffset={sideOffset}
              collisionPadding={collisionPadding}
              className={className}
            >
              <PopoverCard>{content}</PopoverCard>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  );
}
