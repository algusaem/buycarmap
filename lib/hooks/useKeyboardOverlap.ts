"use client";

import { useEffect, useState } from "react";

// docs/specs/redesign-map.md (MAPUI-72). iOS Safari lays its keyboard over the
// page: `100dvh` and the layout viewport stay as they were, and only the
// visual viewport shrinks, so a fixed sheet keeps its height behind the keyboard.

export interface KeyboardOverlap {
  /** How far the visible screen's bottom is over the layout viewport's, in px. */
  bottom: number;
  /** How tall the visible screen is, in px. */
  height: number;
}

/** Less than this covered is a browser toolbar on its way, not a keyboard. */
const MIN_KEYBOARD_HEIGHT = 120;

function readOverlap(): KeyboardOverlap | null {
  const viewport = window.visualViewport;
  // A pinch zoom shrinks the visual viewport too, with no keyboard at all.
  if (viewport?.scale !== 1) return null;
  if (window.innerHeight - viewport.height < MIN_KEYBOARD_HEIGHT) return null;
  return {
    bottom: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height),
    height: viewport.height,
  };
}

/** What the on-screen keyboard covers, or null while it covers nothing. */
export function useKeyboardOverlap(): KeyboardOverlap | null {
  const [overlap, setOverlap] = useState<KeyboardOverlap | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setOverlap(readOverlap());
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  return overlap;
}
