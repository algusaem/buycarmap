"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import type { ComponentProps } from "react";

// FRONT-29 (docs/specs/core-frontend.md, issue #9): the smallest existing
// client boundary that already wraps every page (app/layout.tsx), so every
// Motion animation in the app honours the OS's prefers-reduced-motion
// setting.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
