import { useState } from "react";
import { lastInputWasKeyboard } from "@/lib/input-modality";

/**
 * docs/specs/motion.md (MOTION-23): whether the last change of `value`
 * happened right after a key press (lib/input-modality.ts), read in the
 * render where it changes — adjusting state during render, as the value
 * itself is derived from a prop that just changed. The tab bar (`TabBar`)
 * uses it to tell a key-caused hide or return from a pointer's.
 */
export function useChangedByKey(value: boolean): boolean {
  const [previous, setPrevious] = useState(value);
  const [changedByKey, setChangedByKey] = useState(false);
  if (value !== previous) {
    setPrevious(value);
    setChangedByKey(lastInputWasKeyboard());
  }
  return changedByKey;
}
