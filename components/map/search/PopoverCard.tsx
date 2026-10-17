"use client";

import { type HTMLMotionProps, useIsPresent } from "motion/react";
import * as motion from "motion/react-client";
import { dropdownReveal } from "@/lib/animations";

// docs/specs/redesign-map.md (MAPUI-2); docs/design/system/components/
// SearchPopover/README.md. The animated frame a Radix popover's content renders
// through (`asChild`), for the search pill's popovers, «Crear alerta» and the
// filters dropdown. While AnimatePresence keeps a closed popover mounted to
// animate it out, useIsPresent() flips and the card turns `inert` and
// `aria-hidden`: a closing «Dónde» no longer exposes its combobox while «Coche»
// opens, and a click on the fading card reaches nothing. Radix passes its
// props, `ref` included, through to the motion element.
export function PopoverCard(props: HTMLMotionProps<"div">) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      {...dropdownReveal}
      {...props}
      aria-hidden={isPresent ? undefined : true}
      inert={isPresent ? undefined : true}
    />
  );
}
