import { act } from "@testing-library/react";
import { MotionGlobalConfig, frameData } from "motion/react";

/**
 * Motion's clock inside `withAnimations`. It stands still: an animation moves
 * only when the test moves the clock, never because the machine running the
 * test was slow. Without it, "still mounted while its exit plays" held only
 * while the test ran faster than the 180ms exit, and failed on a loaded CI
 * runner.
 */
export interface MotionClock {
  /**
   * Moves Motion's clock `ms` forward and lets Motion draw that moment: an
   * animation started earlier is `ms` further on, or over and its exit done.
   */
  advance(ms: number): Promise<void>;
  /**
   * Moves the clock past every animation the app plays — the longest is the
   * 240ms sheet (lib/animations.ts), and a spring is at rest well within a
   * second — so whatever was moving has arrived, or has left.
   */
  finish(): Promise<void>;
}

/** Longer than any animation the app plays, springs included (MotionClock.finish). */
const PAST_EVERY_ANIMATION_MS = 1000;

/**
 * How far each frame the clock draws moves it, in ms: below the 1ms Motion
 * rounds an animation's time to, so nothing moves, but enough for Motion to
 * draw again. It draws an element at most once per moment of its clock, so a
 * value set after that (a key's instant reopen) would wait for the next one.
 */
const FRAME_NUDGE_MS = 0.001;

/** Draws the browser's next animation frame, inside `act` (FRAME_NUDGE_MS). */
async function nextFrame(): Promise<void> {
  frameData.timestamp += FRAME_NUDGE_MS;
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

const clock: MotionClock = {
  async advance(ms) {
    // An animation a render just asked for starts on Motion's next frame, at
    // the clock's time then: let it start before the clock moves, or it
    // would start at the later time and not have moved at all.
    await nextFrame();
    frameData.timestamp += ms;
    // One frame for Motion to draw the moment, one for the React render a
    // finished exit triggers (AnimatePresence removing the element).
    await nextFrame();
    await nextFrame();
  },
  finish() {
    return clock.advance(PAST_EVERY_ANIMATION_MS);
  },
};

/**
 * Runs `run` with Motion's real animations enabled instead of the jsdom-wide
 * `skipAnimations` (test/setup.jsdom.ts), on a clock that stands still until
 * `run` moves it (MotionClock), restoring both afterwards even if `run`
 * throws. A test for a transition that still has to be in flight — a closing
 * popover still mounted — turns real animations back on for exactly its own
 * body.
 */
export async function withAnimations(run: (clock: MotionClock) => Promise<void>): Promise<void> {
  MotionGlobalConfig.skipAnimations = false;
  MotionGlobalConfig.useManualTiming = true;
  try {
    await run(clock);
  } finally {
    MotionGlobalConfig.skipAnimations = true;
    MotionGlobalConfig.useManualTiming = false;
  }
}
