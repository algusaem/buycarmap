"use client";

import { type PointerEvent, useEffect, useRef } from "react";
import { samplePress } from "@/lib/sheet-release-velocity";

/**
 * docs/specs/motion.md (MOTION-20): the press/release sampling
 * (lib/sheet-release-velocity.ts's `samplePress`) a draggable sheet's handle
 * drives from its own pointerdown, shared by the results sheet
 * (useResultsSheetDrag) and the phone bottom sheets (SheetChrome's
 * SheetPanel). `releaseVelocityRef` holds the last press's release speed,
 * set on its pointerup, before the caller's `onDragEnd` reads it. `start`
 * ignores a pointer that is not primary, stops any press still being sampled
 * first, and calls `onRelease` (if given) once `releaseVelocityRef` is
 * updated. A press still being sampled when the caller unmounts leaves no
 * window listeners behind.
 */
export function useReleaseSampling(onRelease?: (velocity: number) => void) {
  const releaseVelocityRef = useRef(0);
  // The press in progress, if any: removes its window listeners.
  const pressRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      pressRef.current?.();
      pressRef.current = null;
    },
    [],
  );

  function start(event: PointerEvent) {
    if (!event.isPrimary) return;
    pressRef.current?.();
    releaseVelocityRef.current = 0;
    pressRef.current = samplePress(event, (velocity) => {
      pressRef.current = null;
      releaseVelocityRef.current = velocity;
      onRelease?.(velocity);
    });
  }

  return { releaseVelocityRef, pressRef, start };
}
