"use client";

import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";

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

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <div className="relative h-4 w-4">
        <AnimatePresence mode="wait">
          <motion.div key={theme} {...iconAnimation} className="absolute inset-0">
            <Icon className="h-4 w-4" />
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.span key={theme} {...textAnimation}>
          {isDark ? "Dark" : "Light"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
