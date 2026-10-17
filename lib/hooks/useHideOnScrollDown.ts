import { useEffect, useState } from "react";

function scrollPosition(target: EventTarget): number {
  return target instanceof Element ? target.scrollTop : window.scrollY;
}

/**
 * MAPUI-53 (docs/specs/redesign-map.md): true once the page is scrolled down,
 * false again on scrolling up. The pages scroll inside their own container
 * rather than the window (the root layout's body does not scroll), so the
 * listener captures scroll events from every element and keeps each
 * scroller's last position apart. `resetKey` (the route) shows the bar again
 * on navigation, where the new page starts at the top.
 */
export function useHideOnScrollDown(resetKey: string): boolean {
  const [hidden, setHidden] = useState(false);
  const [key, setKey] = useState(resetKey);

  if (key !== resetKey) {
    setKey(resetKey);
    setHidden(false);
  }

  useEffect(() => {
    const positions = new WeakMap<EventTarget, number>();

    function onScroll(event: Event) {
      const { target } = event;
      if (!target) return;

      const y = scrollPosition(target);
      const previous = positions.get(target) ?? 0;
      positions.set(target, y);

      if (y > previous) setHidden(true);
      if (y < previous) setHidden(false);
    }

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return hidden;
}
