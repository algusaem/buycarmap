/**
 * Shared animation presets for Motion library.
 * Use spread syntax: <motion.div {...fadeInUp}>
 * Or with delay: <motion.div {...fadeIn(0.2)}>
 */

// Base transition configs
const ease = "easeOut" as const;
const duration = {
  fast: 0.3,
  normal: 0.4,
  slow: 0.5,
  hero: 0.6,
};

// Simple animations (no delay parameter)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.slow, ease },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.slow, ease },
};

export const dropdownReveal = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: duration.fast },
};

/** A bottom sheet rising from the screen's edge, and leaving the same way. */
export const sheetSlideUp = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { duration: duration.fast, ease },
};

export const crossFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.fast },
};

// Animations with configurable delay
export const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: duration.normal, delay },
});

/**
 * Whether the OS asks for reduced motion, for the scrolls Motion does not
 * drive (a jump to a pin's card): they land at once instead of gliding.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
