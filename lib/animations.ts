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

// Variant-based animations (for staggered children)
export const fadeInUpVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const staggerContainer = (staggerDelay = 0.1) => ({
  initial: "hidden",
  animate: "visible",
  transition: { staggerChildren: staggerDelay },
});

// Interactive states
export const buttonTap = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
};
