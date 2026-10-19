import { useRef, useState } from "react";

// docs/specs/redesign-map.md (MAPUI-11): the draft of the price range
// (components/map/search/PriceRange.tsx). A two-knob range from 0 to
// 30.000 € in steps of 500 €, where the right knob at the end means no
// maximum, over the «Mínimo» and «Máximo» boxes, which accept any amount:
// above 30.000 € the knob stays at the end and the box keeps the exact amount.
//
// - `slide` follows a knob while it moves; `release` applies it. The right
//   knob stops at 500 €, so it never asks for a maximum of 0.
// - `setMin` and `setMax` apply each edit of a box as typed. A «Máximo» of 0
//   is never applied: the draft keeps the criterion in force.
// - `applyBoxes`, when a box loses focus or on Enter, swaps a minimum typed
//   above the maximum.
//
// `onApply` gets `undefined` for "no minimum" and "no maximum". The draft
// follows the criterion when it changes outside (the pill's price popover,
// «Borrar»).

export const PRICE_RANGE_MAX = 30000;
export const PRICE_RANGE_STEP = 500;

interface PriceDraft {
  min?: number;
  max?: number;
}

/** The knob positions for a draft: an amount above the scale sits at its end. */
function knobsOf({ min, max }: PriceDraft): [number, number] {
  return [Math.min(min ?? 0, PRICE_RANGE_MAX), Math.min(max ?? PRICE_RANGE_MAX, PRICE_RANGE_MAX)];
}

/** The left knob's amount: unmoved, the exact amount; at 0, no minimum. */
function leftAmount(left: number, current: number, kept: number | undefined) {
  if (left === current) return kept;
  if (left === 0) return undefined;
  return left;
}

/** The right knob's amount: unmoved, the exact amount; at the end, no maximum. */
function rightAmount(right: number, current: number, kept: number | undefined) {
  if (right === current) return kept;
  if (right >= PRICE_RANGE_MAX) return undefined;
  return right;
}

/** The amounts for knob positions; the right knob stops one step above 0. */
function fromKnobs([left = 0, right = PRICE_RANGE_MAX]: number[], draft: PriceDraft): PriceDraft {
  const [currentLeft, currentRight] = knobsOf(draft);
  return {
    min: leftAmount(left, currentLeft, draft.min),
    max: rightAmount(Math.max(right, PRICE_RANGE_STEP), currentRight, draft.max),
  };
}

/** An edit not rendered yet, and the draft it was made from. */
interface PendingEdit {
  from: PriceDraft;
  next: PriceDraft;
}

export function usePriceDraft(
  minPrice: number | undefined,
  maxPrice: number | undefined,
  onApply: (minPrice: number | undefined, maxPrice: number | undefined) => void,
) {
  const [draft, setDraft] = useState<PriceDraft>({ min: minPrice, max: maxPrice });
  const [synced, setSynced] = useState<PriceDraft>({ min: minPrice, max: maxPrice });
  if (synced.min !== minPrice || synced.max !== maxPrice) {
    setSynced({ min: minPrice, max: maxPrice });
    setDraft({ min: minPrice, max: maxPrice });
  }
  // Radix and the boxes can call twice in one event, before a re-render (a
  // key press moves and releases a knob at once). The ref, written only here
  // in the handlers, carries the latest edit across those calls; once the
  // draft it was made from is no longer the rendered one, the rendered draft
  // is the latest.
  const pendingRef = useRef<PendingEdit | null>(null);

  function latest(): PriceDraft {
    const pending = pendingRef.current;
    return pending?.from === draft ? pending.next : draft;
  }

  function show(next: PriceDraft) {
    pendingRef.current = { from: draft, next };
    setDraft(next);
  }

  function apply(next: PriceDraft) {
    show(next);
    onApply(next.min, next.max);
  }

  function setMax(max: number | undefined) {
    if (max === 0) return;
    apply({ ...latest(), max });
  }

  function applyBoxes() {
    const { min, max } = latest();
    if (min == null || max == null || min <= max) return;
    apply({ min: max, max: min });
  }

  return {
    draft,
    knobs: knobsOf(draft),
    slide: (values: number[]) => show(fromKnobs(values, latest())),
    release: (values: number[]) => apply(fromKnobs(values, latest())),
    setMin: (min: number | undefined) => apply({ ...latest(), min }),
    setMax,
    applyBoxes,
  };
}
