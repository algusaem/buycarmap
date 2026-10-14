import { MotionGlobalConfig } from "motion/react";

/**
 * Runs `run` with Motion's real exit animation enabled instead of the
 * jsdom-wide `skipAnimations` (test/setup.jsdom.ts), restoring it afterwards
 * even if `run` throws. A test for a transition that still has to be in
 * flight — a fading listbox option still pressable, a closing popover still
 * mounted — turns real animations back on for exactly its own body.
 */
export async function withAnimations(run: () => Promise<void>): Promise<void> {
  MotionGlobalConfig.skipAnimations = false;
  try {
    await run();
  } finally {
    MotionGlobalConfig.skipAnimations = true;
  }
}
