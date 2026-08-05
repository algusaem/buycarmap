"use client";

import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/useMounted";
import { useThemeTransition } from "@/lib/hooks/useThemeTransition";
import { useTranslation } from "@/lib/i18n/client";

const iconAnimation = {
  initial: { opacity: 0, rotate: -90, scale: 0.5 },
  animate: { opacity: 1, rotate: 0, scale: 1 },
  exit: { opacity: 0, rotate: 90, scale: 0.5 },
  transition: { duration: 0.2 },
};

const textAnimation = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.15 },
};

interface ThemeSwitcherProps {
  /**
   * Whether to render the theme's name beside the icon. Off in the desktop
   * navbar, where the icon already says it and the row is tight; on inside the
   * mobile menu, which has the room. Defaults to on so every other caller —
   * and CORE-10's label test — keeps the behaviour it had.
   */
  showLabel?: boolean;
}

export function ThemeSwitcher({ showLabel = true }: ThemeSwitcherProps) {
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const { t } = useTranslation();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-5 w-16" />;
  }

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Moon : Sun;
  const label = isDark ? t.theme.dark : t.theme.light;

  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      // Without the text the button still needs a name, and it has to be the
      // same string the label would have been — e2e/theme.spec.ts finds this
      // control by that name at both sizes.
      aria-label={showLabel ? undefined : label}
      // h-11 rather than the default h-9: this renders inside the mobile menu,
      // where 36px is under the 44px touch floor NAV-2 enforces.
      className="h-11 gap-2 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-primary dark:hover:bg-transparent"
    >
      <div className="relative h-4 w-4">
        <AnimatePresence mode="wait">
          <motion.div key={resolvedTheme} {...iconAnimation} className="absolute inset-0">
            <Icon className="h-4 w-4" />
          </motion.div>
        </AnimatePresence>
      </div>
      {showLabel && (
        <AnimatePresence mode="wait">
          <motion.span key={resolvedTheme} {...textAnimation}>
            {label}
          </motion.span>
        </AnimatePresence>
      )}
    </Button>
  );
}
