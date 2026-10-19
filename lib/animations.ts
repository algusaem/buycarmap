/**
 * Shared animation presets for Motion library.
 * Use spread syntax: <motion.div {...fadeInUp}>
 *
 * Every preset reads the motion tokens below, the same durations and curve
 * `app/globals.css` sets for CSS transitions (MOTION-1, MOTION-2,
 * docs/specs/motion.md).
 */

/** The motion durations in seconds: state changes, popovers and fades, sheets (MOTION-2). */
export const motionDuration = { fast: 0.12, base: 0.18, sheet: 0.24 } as const;

/** The shared ease-out curve, `--ease-out` in `app/globals.css` (MOTION-1). */
export const easeOut = [0.23, 1, 0.32, 1] as const;

// Simple animations (no delay parameter)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: motionDuration.sheet, ease: easeOut },
};

export const dropdownReveal = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: motionDuration.base, ease: easeOut },
};

/** A bottom sheet rising from the screen's edge, and leaving the same way. */
export const sheetSlideUp = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { duration: motionDuration.sheet, ease: easeOut },
};

export const crossFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: motionDuration.base, ease: easeOut },
};

/** A dragged bottom sheet springing to where it rests: back in place, or to a new position. */
export const sheetSpring = { type: "spring", stiffness: 500, damping: 40 } as const;

/** No animation to play: the element is drawn at its target, or removed, at once. */
export const instantTransition = { duration: 0 } as const;

/**
 * Whether the OS asks for reduced motion, for the scrolls Motion does not
 * drive (a jump to a pin's card): they land at once instead of gliding.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
