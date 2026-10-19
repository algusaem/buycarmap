import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { CarListing } from "@/interfaces/listing";
import { cardDomId } from "@/lib/map/card-dom-id";

// docs/specs/redesign-saved.md (SAVED-18, SAVED-21): where the focus goes
// after a removal, on the phone and on desktop alike — the neighbour's first
// control, or the empty state's heading when no car is left. The control that
// takes it becomes the one the car sheet returns the focus to.

/** Where the focus goes once a removal has been drawn: a car, or the empty state's heading. */
type FocusTarget = { listingId: string; scrolled: boolean } | "empty";

/** A card's first control, its link, or the compact row itself. */
function firstControl(listingId: string): HTMLElement | null {
  const item = document.getElementById(cardDomId(listingId));
  if (!item || item instanceof HTMLButtonElement) return item;
  return item.querySelector("a");
}

interface RemovalFocusOptions {
  /** The cars shown, in order. */
  shown: CarListing[];
  /** Brings the car at an index into view, so the virtualised list mounts it (lib/hooks/useSavedList.ts). */
  scrollToCar: (index: number) => void;
  /** The control the car sheet gives the focus back to (lib/hooks/useSavedCarSheet.ts). */
  returnFocusRef: RefObject<HTMLElement | null>;
  /** The list's scrolling column: a press or a wheel in it means the buyer has moved on. */
  listRef: RefObject<HTMLElement | null>;
}

export function useRemovalFocus({
  shown,
  scrollToCar,
  returnFocusRef,
  listRef,
}: RemovalFocusOptions) {
  const pendingFocusRef = useRef<FocusTarget | null>(null);

  // A pending target lasts only until the buyer's next move: the focus going
  // anywhere else, or a press or a wheel in the list. A neighbour that mounts
  // later (a scroll that ran long, a row the buyer scrolled past) then never
  // takes the focus from wherever the buyer has put it.
  useEffect(() => {
    const expire = () => {
      pendingFocusRef.current = null;
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = pendingFocusRef.current;
      if (!target) return;
      if (target !== "empty" && event.target === firstControl(target.listingId)) return;
      expire();
    };
    const onListInput = (event: Event) => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) expire();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onListInput);
    document.addEventListener("wheel", onListInput, { passive: true });
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onListInput);
      document.removeEventListener("wheel", onListInput);
    };
  }, [listRef]);

  // SAVED-18: after every render while a removal's focus is pending, the
  // neighbour's first control takes it once it is in the DOM. A neighbour the
  // virtualised list has not mounted (the removal came from a pin far down the
  // list) is scrolled to first; the renders that scroll causes mount it.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target || target === "empty") return;
    const element = firstControl(target.listingId);
    if (element) {
      pendingFocusRef.current = null;
      element.focus();
      returnFocusRef.current = element;
      return;
    }
    const index = shown.findIndex((car) => car.id === target.listingId);
    if (index === -1) {
      // The neighbour went too (a second removal): nothing left to focus.
      pendingFocusRef.current = null;
      return;
    }
    if (target.scrolled) return;
    target.scrolled = true;
    scrollToCar(index);
  });

  /**
   * The empty state's heading, which mounts in place of the list the moment
   * the last car is removed (MOTION-19): it takes the focus as it mounts.
   */
  const emptyHeadingRef = useCallback(
    (heading: HTMLHeadingElement | null) => {
      if (!heading || pendingFocusRef.current !== "empty") return;
      pendingFocusRef.current = null;
      heading.focus();
      returnFocusRef.current = heading;
    },
    [returnFocusRef],
  );

  return {
    emptyHeadingRef,
    /** A car was removed: the focus goes to `neighbour`, or to the empty state when none is left. */
    focusAfterRemoval: (neighbour: CarListing | undefined) => {
      pendingFocusRef.current = neighbour ? { listingId: neighbour.id, scrolled: false } : "empty";
    },
    /**
     * A removal was undone: a car is back, so the empty state's heading no
     * longer waits for the focus. The heading mounts with the removal itself
     * and takes the focus then, so by the time «Deshacer» can be pressed
     * nothing is usually left waiting; this keeps a heading that has not
     * mounted yet from taking it later.
     */
    cancelEmptyFocus: () => {
      if (pendingFocusRef.current === "empty") pendingFocusRef.current = null;
    },
  };
}
