"use client";

import { useEffect, useState } from "react";

// docs/specs/redesign-map.md (MAPUI-72). iOS Safari lays its keyboard over the
// page and `100dvh` stays as it was, so a fixed sheet keeps its height behind
// the keyboard. Only the visual viewport tells what is left to see: nothing
// here tries to tell whether a keyboard is up.

export interface VisibleScreen {
  /** Where the visible part ends, in px from the top of the layout viewport. */
  bottom: number;
  /** How tall the visible part is, in px. */
  height: number;
}

function readVisibleScreen(): VisibleScreen | null {
  const viewport = window.visualViewport;
  // A pinch zoom shrinks the visual viewport too, and the sheet stays put.
  if (viewport?.scale !== 1) return null;
  return { bottom: viewport.offsetTop + viewport.height, height: viewport.height };
}

/** The part of the screen left visible, or null where it cannot be read. */
export function useVisibleScreen(): VisibleScreen | null {
  const [visible, setVisible] = useState<VisibleScreen | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setVisible(readVisibleScreen());
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  return visible;
}
