import { useIsPresent } from "motion/react";
import { useState } from "react";
import { instantTransition } from "@/lib/animations";
import { lastInputWasKeyboard } from "@/lib/input-modality";

// docs/specs/motion.md (MOTION-10 to MOTION-12, MOTION-15, MOTION-18): a
// preset from lib/animations.ts for an element that opens and closes inside
// an AnimatePresence, made instant when a key opened or closed it
// (lib/input-modality.ts). The entrance is read when the element mounts, and
// again when it is brought back while its exit still plays (reopened
// mid-exit), when Motion plays `animate` again rather than `initial`. The
// exit is read in the render where AnimatePresence marks the element as
// leaving: Motion freezes a leaving element's props from its parent, but this
// hook's own `useIsPresent()` re-renders it at that moment, so the exit
// follows the input that closed it (a click to open and Escape to close
// animates only the open). `instantExit` makes the exit instant whatever the
// input, for an element whose leaving is not seen.

interface PresencePreset {
  initial: object;
  animate: object;
  exit?: object;
  transition: object;
}

export function usePresenceMotion<T extends PresencePreset>(preset: T, instantExit = false) {
  const isPresent = useIsPresent();
  const [openedByKey, setOpenedByKey] = useState(lastInputWasKeyboard);
  const [wasPresent, setWasPresent] = useState(isPresent);
  if (isPresent !== wasPresent) {
    setWasPresent(isPresent);
    if (isPresent) setOpenedByKey(lastInputWasKeyboard());
  }
  const closedInstantly = !isPresent && (instantExit || lastInputWasKeyboard());

  return {
    ...preset,
    initial: openedByKey ? (false as const) : preset.initial,
    // The entrance's own timing; a reopen mid-exit plays it from where the exit got to.
    transition: openedByKey ? instantTransition : preset.transition,
    // The exit carries its own timing, so a key's instant entrance never makes a pointer's close instant.
    exit: preset.exit && {
      ...preset.exit,
      transition: closedInstantly ? instantTransition : preset.transition,
    },
  };
}
