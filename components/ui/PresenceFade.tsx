"use client";

import type { HTMLMotionProps } from "motion/react";
import * as motion from "motion/react-client";
import { crossFade, type dropdownReveal } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";

interface PresenceFadeProps extends HTMLMotionProps<"div"> {
  /** The preset from lib/animations.ts it plays: the cross-fade unless told otherwise. */
  preset?: typeof crossFade | typeof dropdownReveal;
}

/**
 * docs/specs/motion.md (MOTION-12, MOTION-18, MOTION-23): the fade of a
 * dialog's dimmed overlay and of a desktop dialog, or another preset's
 * entrance and exit (the select dropdown's reveal), inside the caller's
 * AnimatePresence — with the preset's timing for a pointer, at once when a
 * key opened or closed it (usePresenceMotion). Radix passes its props, `ref`
 * included, through to the motion element.
 */
export function PresenceFade({ preset = crossFade, ...props }: PresenceFadeProps) {
  const fade = usePresenceMotion(preset);

  return <motion.div {...fade} {...props} />;
}
