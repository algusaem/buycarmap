import { useTheme } from "next-themes";
import { useCallback, useRef } from "react";

export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const isAnimating = useRef(false);

  const toggleTheme = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const newTheme = resolvedTheme === "dark" ? "light" : "dark";

      // Skip animation if View Transitions not supported or already animating
      if (!document.startViewTransition || isAnimating.current) {
        setTheme(newTheme);
        return;
      }

      // Get click position for the circle origin
      const x = event.clientX;
      const y = event.clientY;

      // Calculate the radius needed to cover the entire screen
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      isAnimating.current = true;

      const transition = document.startViewTransition(() => {
        setTheme(newTheme);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
          },
          {
            duration: 400,
            easing: "ease-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });

      transition.finished.then(() => {
        isAnimating.current = false;
      });
    },
    [resolvedTheme, setTheme],
  );

  return { resolvedTheme, toggleTheme };
}
