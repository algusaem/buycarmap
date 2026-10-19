import { useEffect, useState } from "react";

interface ScrollPosition {
  top: number;
  atEnd: boolean;
}

function scrollPosition(target: EventTarget): ScrollPosition {
  const scroller = target instanceof Element ? target : document.scrollingElement;
  const top = target instanceof Element ? target.scrollTop : window.scrollY;
  if (!scroller) return { top, atEnd: false };

  // Something with nothing to scroll has no end to reach. The 1px allowance
  // absorbs the fractional scrollTop a zoomed page stops at.
  const room = scroller.scrollHeight - scroller.clientHeight;
  return { top, atEnd: room > 0 && top >= room - 1 };
}

/**
 * MAPUI-53 (docs/specs/redesign-map.md): true once the page is scrolled down,
 * false again on scrolling up or once the scroll reaches its end, where the
 * page's bottom padding keeps its last control clear of a showing bar (#142).
 * The pages scroll inside their own container rather than the window (the
 * root layout's body does not scroll), so the listener captures scroll events
 * from every element and keeps each scroller's last position apart.
 * `resetKey` (the route) shows the bar again on navigation, where the new page
 * starts at the top.
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

      const { top, atEnd } = scrollPosition(target);
      const previous = positions.get(target) ?? 0;
      positions.set(target, top);

      if (atEnd || top < previous) {
        setHidden(false);
        return;
      }
      if (top > previous) setHidden(true);
    }

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return hidden;
}
