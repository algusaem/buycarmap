"use client";

import { type HTMLMotionProps, useIsPresent } from "motion/react";
import * as motion from "motion/react-client";
import { dropdownReveal } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";

// docs/specs/redesign-map.md (MAPUI-2); docs/design/system/components/
// SearchPopover/README.md. The animated frame a Radix popover's content renders
// through (`asChild`), for the search pill's popovers, «Crear alerta» and the
// filters dropdown. While AnimatePresence keeps a closed popover mounted to
// animate it out, useIsPresent() flips and the card turns `inert` and
// `aria-hidden`: a closing «Dónde» no longer exposes its combobox while «Coche»
// opens, and a click on the fading card reaches nothing. Radix passes its
// props, `ref` included, through to the motion element. Opened with Enter or
// Space it appears at once, and closed with Escape it leaves at once; a pointer
// keeps the 180ms fade both ways (MOTION-10).
export function PopoverCard(props: HTMLMotionProps<"div">) {
  const isPresent = useIsPresent();
  const reveal = usePresenceMotion(dropdownReveal);

  return (
    <motion.div
      {...reveal}
      {...props}
      aria-hidden={isPresent ? undefined : true}
      inert={isPresent ? undefined : true}
    />
  );
}
