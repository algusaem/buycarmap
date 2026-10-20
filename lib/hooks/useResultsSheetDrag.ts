"use client";

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { sheetSpring } from "@/lib/animations";
import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";
import { useReleaseSampling } from "@/lib/hooks/useReleaseSampling";
import { lastInputWasKeyboard } from "@/lib/input-modality";
import { type SheetTops, settleSheetPosition } from "@/lib/map/sheet-position";

// docs/specs/redesign-map.md (MAPUI-23, MAPUI-59, MAPUI-60);
// docs/design/system/components/BottomSheet/README.md › Arrastrar. Once
// placed, the phone results sheet is laid out as tall as the area it sits in,
// and each position is only how far down it is translated (`y`): its lower
// edge stays at the area's bottom, behind the tab bar (whatever is translated
// below the area is clipped by it), and only its top edge moves. A drag, which
// starts only from the handle strip and the title (`startDrag`), never from
// the list, moves `y` with the finger, so the sheet always reaches from the
// finger down; on release it settles on a position (settleSheetPosition) and
// springs to it, as it does on a handle press, and jumps under reduced motion.
// A position change made from the keyboard (Enter or Space on the handle)
// jumps too, stopping any spring in flight (MOTION-14).
//
// The positions' offsets are measured from the layout, never hardcoded: full
// is the top of the area, middle the top of an empty probe drawn with the
// middle position's classes, and peeked the top of a probe with the peeked
// position's padding, less the header's height. They are measured again
// whenever the area or the header changes size (a rotation, a new results
// count), and the sheet then jumps to its position's new offset. Until they
// are measured (the server render, the first client render) the sheet keeps
// its resting layout for its position (`placed` is false).

/** How long after a drag ends its click is still the drag's, not a handle press (MAPUI-59). */
const CLICK_AFTER_DRAG_MS = 400;

interface UseResultsSheetDragOptions {
  position: ResultsSheetPosition;
  onPositionChange: (position: ResultsSheetPosition) => void;
  /** At desktop width the sheet is the list column: no offset, no drag. */
  docked: boolean;
}

/** Where a press began: the finger's clientY and the sheet's top edge, both in px from the screen top. */
interface PressOrigin {
  pointerY: number;
  sheetTop: number;
}

function sameOffsets(a: SheetTops | null, b: SheetTops | null): boolean {
  if (!a || !b) return a === b;
  return a.full === b.full && a.middle === b.middle && a.peeked === b.peeked;
}

/** Each position's top edge, in px from the screen top; null until every part is mounted. */
function measureTops(
  sheet: HTMLElement | null,
  header: HTMLElement | null,
  middleProbe: HTMLElement | null,
  peekedProbe: HTMLElement | null,
): SheetTops | null {
  const area = sheet?.parentElement;
  if (!header || !middleProbe || !peekedProbe || !area) return null;
  return {
    full: area.getBoundingClientRect().top,
    middle: middleProbe.getBoundingClientRect().top,
    peeked: peekedProbe.getBoundingClientRect().top - header.offsetHeight,
  };
}

export function useResultsSheetDrag({
  position,
  onPositionChange,
  docked,
}: UseResultsSheetDragOptions) {
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const middleProbeRef = useRef<HTMLDivElement>(null);
  const peekedProbeRef = useRef<HTMLDivElement>(null);
  // Whether the press that is ending moved the sheet: its release then settles it, not endPress.
  const draggedRef = useRef(false);
  // When the last drag ended (performance.now()): a click this soon after is not a handle press.
  const dragEndedAtRef = useRef<number | null>(null);
  // Whether a finger is moving the sheet right now: a re-measure then leaves `y` to it.
  const draggingRef = useRef(false);
  // The position `y` was last put at, and whether it has been put anywhere yet.
  const placedAtRef = useRef<ResultsSheetPosition | null>(null);
  // Where the press began, and where its finger last was (its release, once let go): MAPUI-59.
  const pressOriginRef = useRef<PressOrigin | null>(null);
  const pointerYRef = useRef(0);
  // Stops following the press's finger, if it is still followed.
  const stopFollowingRef = useRef<(() => void) | null>(null);
  const [offsets, setOffsets] = useState<SheetTops | null>(null);
  // The same as draggingRef, for what the sheet draws while a finger moves it.
  const [dragging, setDragging] = useState(false);
  // Docked, there are no offsets, whatever was last measured on a phone.
  const activeOffsets = docked ? null : offsets;

  /** `y` to `target`: with the spring when `animated` and motion is allowed, else at once (stopping any spring). */
  const moveTo = useCallback(
    (target: number, animated: boolean) => {
      if (animated && !reduceMotion) {
        animate(y, target, sheetSpring);
        return;
      }
      y.jump(target);
    },
    [reduceMotion, y],
  );

  // The offsets, measured on the first phone render and again on every
  // resize of the area or the header.
  useLayoutEffect(() => {
    if (docked) return;
    const update = () => {
      const tops = measureTops(
        sheetRef.current,
        headerRef.current,
        middleProbeRef.current,
        peekedProbeRef.current,
      );
      const next = tops && {
        full: 0,
        middle: tops.middle - tops.full,
        peeked: tops.peeked - tops.full,
      };
      setOffsets((previous) => (sameOffsets(previous, next) ? previous : next));
    };
    update();
    const observer = new ResizeObserver(update);
    const area = sheetRef.current?.parentElement;
    if (area) observer.observe(area);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [docked]);

  // Puts the sheet at its position's offset before the paint: at once the
  // first time, after a re-measure, under reduced motion and after a key; with
  // the spring when a pointer changed the position (a release, a handle press).
  useLayoutEffect(() => {
    if (!activeOffsets) {
      placedAtRef.current = null;
      y.jump(0);
      return;
    }
    if (draggingRef.current) return;
    const moved = placedAtRef.current !== null && placedAtRef.current !== position;
    placedAtRef.current = position;
    moveTo(activeOffsets[position], moved && !lastInputWasKeyboard());
  }, [activeOffsets, position, moveTo, y]);

  /** Back to `position`'s offset, when a press or a release settles where it started. */
  function settleBack() {
    if (!activeOffsets) return;
    moveTo(activeOffsets[position], true);
  }
  // A press's pointerup listener outlives the render it was added in: it
  // settles back through this ref, so it reads the latest position and offsets.
  const settleBackRef = useRef(settleBack);
  useLayoutEffect(() => {
    settleBackRef.current = settleBack;
  });

  // The press/release sampling (MOTION-20) a handle press drives, shared with
  // the phone bottom sheets; a release that did not drag settles the sheet back.
  const {
    releaseVelocityRef,
    pressRef,
    start: startSampling,
  } = useReleaseSampling(() => {
    if (draggedRef.current) {
      dragEndedAtRef.current = performance.now();
      return;
    }
    settleBackRef.current();
  });

  useEffect(
    () => () => {
      stopFollowingRef.current?.();
      stopFollowingRef.current = null;
    },
    [],
  );

  /**
   * Follows the press's finger (`pointerId`) on the window until it is let go
   * or cancelled, keeping pointerYRef at its latest clientY: on a release, the
   * point where it left the screen; on a cancel, which carries no position,
   * its last move's.
   */
  function followPointer(pointerId: number) {
    stopFollowingRef.current?.();
    function stop() {
      window.removeEventListener("pointermove", track, { capture: true });
      window.removeEventListener("pointerup", end, { capture: true });
      window.removeEventListener("pointercancel", end, { capture: true });
      stopFollowingRef.current = null;
    }
    function track(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return;
      pointerYRef.current = event.clientY;
    }
    function end(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (event.type === "pointerup") pointerYRef.current = event.clientY;
      stop();
    }
    window.addEventListener("pointermove", track, { capture: true });
    window.addEventListener("pointerup", end, { capture: true });
    window.addEventListener("pointercancel", end, { capture: true });
    stopFollowingRef.current = stop;
  }

  // Motion calls it after the frame is drawn, so the press's pointerup has
  // already set releaseVelocityRef and pointerYRef. The release point is the
  // sheet's top at the press plus the finger's travel, kept between full and
  // peeked — never the edge last drawn, which lags the finger when the
  // browser skips frames (MAPUI-59, worked example «Release point»).
  function onDragEnd() {
    draggingRef.current = false;
    setDragging(false);
    const tops = measureTops(
      sheetRef.current,
      headerRef.current,
      middleProbeRef.current,
      peekedProbeRef.current,
    );
    const origin = pressOriginRef.current;
    if (!tops || !origin) {
      settleBack();
      return;
    }
    const travel = pointerYRef.current - origin.pointerY;
    const releaseTop = Math.min(Math.max(origin.sheetTop + travel, tops.full), tops.peeked);
    const next = settleSheetPosition({
      start: position,
      releaseTop,
      velocityY: releaseVelocityRef.current,
      tops,
    });
    if (next === position) {
      settleBack();
      return;
    }
    onPositionChange(next);
  }

  return {
    sheetRef,
    headerRef,
    middleProbeRef,
    peekedProbeRef,
    /** Whether the phone sheet has been put at its position yet (until then it keeps its resting layout). */
    placed: activeOffsets !== null,
    /** Where the sheet's top edge rests at its position, in px from the area's top; null until measured or docked. */
    restingTop: activeOffsets ? activeOffsets[position] : null,
    /** Whether a finger is moving the sheet right now. */
    dragging,
    /** The sheet's own drag props, for a vertical drag driven only by `startDrag`, between full and peeked. */
    dragProps: {
      style: { y },
      dragControls,
      dragListener: false,
      dragMomentum: false,
      dragConstraints: activeOffsets
        ? { top: activeOffsets.full, bottom: activeOffsets.peeked }
        : undefined,
      dragElastic: 0,
      onDragStart: () => {
        draggedRef.current = true;
        draggingRef.current = true;
        setDragging(true);
      },
      onDragEnd,
    },
    /** On a pointerdown of the handle strip or the header. */
    startDrag: (event: PointerEvent) => {
      // Only the first finger presses: a second one, or one while a press lasts, starts nothing.
      if (!event.isPrimary || pressRef.current) return;
      draggedRef.current = false;
      dragEndedAtRef.current = null;
      const sheet = sheetRef.current;
      pressOriginRef.current = sheet
        ? { pointerY: event.clientY, sheetTop: sheet.getBoundingClientRect().top }
        : null;
      pointerYRef.current = event.clientY;
      followPointer(event.pointerId);
      dragControls.start(event);
      // The press stops a running spring; one that ends without a drag puts
      // the sheet back at its position (a drag's own release is onDragEnd's).
      // A drag's end is timed here, on its pointerup, not in onDragEnd: Motion
      // calls onDragEnd after the frame is drawn, by when the click that
      // follows the release has already reached the handle. Another finger's
      // release does not end this press.
      startSampling(event);
    },
    /** Whether a click on the handle ends a drag (within CLICK_AFTER_DRAG_MS of its end) rather than pressing it; reading it clears it. */
    consumeDrag: () => {
      const endedAt = dragEndedAtRef.current;
      dragEndedAtRef.current = null;
      return endedAt !== null && performance.now() - endedAt <= CLICK_AFTER_DRAG_MS;
    },
  };
}
