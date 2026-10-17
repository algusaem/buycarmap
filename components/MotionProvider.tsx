"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// FRONT-29 (docs/specs/core-frontend.md, issue #9): the client boundary that
// wraps every page (app/layout.tsx), so every Motion animation in the app
// honours the OS's prefers-reduced-motion setting.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
