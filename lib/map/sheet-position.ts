import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";

// docs/specs/redesign-map.md (MAPUI-58 to MAPUI-62, #133);
// docs/design/system/components/BottomSheet/README.md › Arrastrar. Pure
// position logic for the phone results sheet: one step up from the handle
// (MAPUI-58), and where a release settles after a drag (MAPUI-59, MAPUI-60).
// Reuses useMapPageState's own position type rather than a second one.

/**
 * A release faster than this, in px/s, is a flick (MAPUI-60); exactly this
 * fast is not. The modal sheets' drag to close shares it (SAVED-39).
 */
export const FLICK_VELOCITY = 800;

/** A value in px for each position: its top edge, or its offset. */
export type SheetTops = Record<ResultsSheetPosition, number>;

export interface SettleSheetPositionInput {
  /** The position the drag started from. */
  start: ResultsSheetPosition;
  /** The sheet's top edge, in px from the screen top, at release. */
  releaseTop: number;
  /** px/s at release; positive is downward (MAPUI-60). */
  velocityY: number;
  /** Each position's top edge, in px from the screen top. */
  tops: SheetTops;
}

/** One position up, and one down, from each; each end steps to itself. */
const UP: Record<ResultsSheetPosition, ResultsSheetPosition> = {
  peeked: "middle",
  middle: "full",
  full: "full",
};
const DOWN: Record<ResultsSheetPosition, ResultsSheetPosition> = {
  peeked: "peeked",
  middle: "peeked",
  full: "middle",
};
const POSITIONS: readonly ResultsSheetPosition[] = ["peeked", "middle", "full"];

/**
 * One step up from `position`: peeked -> middle, middle -> full, full ->
 * peeked (MAPUI-58).
 */
export function nextPositionUp(position: ResultsSheetPosition): ResultsSheetPosition {
  return position === "full" ? "peeked" : UP[position];
}

/**
 * Where a drag released from `start` settles: the position whose top edge is
 * nearest `releaseTop`, unless the release was a flick, which moves exactly
 * one position from `start` in its direction, stopping at either end
 * (MAPUI-59, MAPUI-60).
 */
export function settleSheetPosition({
  start,
  releaseTop,
  velocityY,
  tops,
}: SettleSheetPositionInput): ResultsSheetPosition {
  if (Math.abs(velocityY) > FLICK_VELOCITY) {
    // Positive is downward, toward peeked.
    return velocityY > 0 ? DOWN[start] : UP[start];
  }
  const distance = (position: ResultsSheetPosition) => Math.abs(tops[position] - releaseTop);
  return POSITIONS.reduce((nearest, position) =>
    distance(position) < distance(nearest) ? position : nearest,
  );
}
