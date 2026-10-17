"use client";

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  animate,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { sheetSpring } from "@/lib/animations";
import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";
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
  // The press in progress, if any: removes its window listeners. A second
  // finger's pointerdown while it lasts starts nothing.
  const pressRef = useRef<(() => void) | null>(null);
  // The position `y` was last put at, and whether it has been put anywhere yet.
  const placedAtRef = useRef<ResultsSheetPosition | null>(null);
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
  // first time, after a re-measure and under reduced motion; with the spring
  // when the position itself changed (a release, a handle press).
  useLayoutEffect(() => {
    if (!activeOffsets) {
      placedAtRef.current = null;
      y.jump(0);
      return;
    }
    if (draggingRef.current) return;
    const moved = placedAtRef.current !== null && placedAtRef.current !== position;
    placedAtRef.current = position;
    moveTo(activeOffsets[position], moved);
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

  // A press still in progress when the sheet unmounts leaves no window listeners behind.
  useEffect(
    () => () => {
      pressRef.current?.();
      pressRef.current = null;
    },
    [],
  );

  function onDragEnd(_event: globalThis.PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    draggingRef.current = false;
    setDragging(false);
    const tops = measureTops(
      sheetRef.current,
      headerRef.current,
      middleProbeRef.current,
      peekedProbeRef.current,
    );
    const sheet = sheetRef.current;
    if (!tops || !sheet) {
      settleBack();
      return;
    }
    const next = settleSheetPosition({
      start: position,
      releaseTop: sheet.getBoundingClientRect().top,
      velocityY: info.velocity.y,
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
      const { pointerId } = event;
      draggedRef.current = false;
      dragEndedAtRef.current = null;
      dragControls.start(event);
      // The press stops a running spring; one that ends without a drag puts
      // the sheet back at its position (a drag's own release is onDragEnd's).
      // A drag's end is timed here, on its pointerup, not in onDragEnd: Motion
      // calls onDragEnd after the frame is drawn, by when the click that
      // follows the release has already reached the handle.
      const removeListeners = () => {
        window.removeEventListener("pointerup", endPress);
        window.removeEventListener("pointercancel", endPress);
      };
      function endPress(upEvent: globalThis.PointerEvent) {
        // Another finger's release does not end this press.
        if (upEvent.pointerId !== pointerId) return;
        removeListeners();
        pressRef.current = null;
        if (draggedRef.current) {
          dragEndedAtRef.current = performance.now();
          return;
        }
        settleBackRef.current();
      }
      pressRef.current = removeListeners;
      window.addEventListener("pointerup", endPress);
      window.addEventListener("pointercancel", endPress);
    },
    /** Whether a click on the handle ends a drag (within CLICK_AFTER_DRAG_MS of its end) rather than pressing it; reading it clears it. */
    consumeDrag: () => {
      const endedAt = dragEndedAtRef.current;
      dragEndedAtRef.current = null;
      return endedAt !== null && performance.now() - endedAt <= CLICK_AFTER_DRAG_MS;
    },
  };
}
