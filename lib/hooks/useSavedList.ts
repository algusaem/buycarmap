import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import type { CarListing } from "@/interfaces/listing";
import { prefersReducedMotion } from "@/lib/animations";
import type { SavedColumns } from "@/lib/hooks/useSavedColumns";
import { NO_IDS } from "@/lib/hooks/useSavedPins";

// docs/specs/redesign-saved.md (SAVED-14, SAVED-25 to SAVED-29); ADR 0021.
// The saved cars' virtualised list: only the rows in view and a bounded margin
// are mounted. A row is one line of cards on desktop (two or three) and one
// compact row on the phone. What a plain list gives for free is rebuilt here:
// a pin's card is scrolled to by its row (SAVED-26), the scroll is restored on
// Back from the history entry's own record (SAVED-27), a removed car fades out
// where it was drawn (a leaving entry, below), and a car an undo brings back
// fades in where it lands (an arriving car).

// Close to a row's real height, so the scrollbar barely moves as rows are
// measured: a Guardados card is a 20:17 photo of 231–242px plus its text, a
// compact row its 86px thumbnail.
const ESTIMATE = { desktop: 300, phone: 86 };
// The gap between rows: 28px between cards (R3-favoritos), 18px between rows.
const GAP = { desktop: 28, phone: 18 };
// Rows mounted past each edge of the view. At 1440×900 at most four rows of
// three meet the 820px view, so 4 + 2 × 3 rows are 30 cards; at 390×844 at
// most nine rows meet the 780px view, so 9 + 2 × 7 are 23 (SAVED-25's bound).
// One row past the edge is what Tab needs to reach the next item (SAVED-28).
const OVERSCAN = { desktop: 3, phone: 7 };

// What is stored is the first wholly visible car's index, not its row's, so a
// column count that changed between leaving and coming back lands on the same
// car.
const STORAGE_PREFIX = "buycarmap:saved-car:";

/**
 * The history entry's own key, so Back restores the scroll of the very entry it
 * returns to and a fresh visit starts at the top. Without the Navigation API
 * every visit in the tab shares one record.
 */
function storageKey(): string {
  return `${STORAGE_PREFIX}${window.navigation?.currentEntry?.key ?? "tab"}`;
}

function readCarIndex(): number {
  try {
    return Number(window.sessionStorage.getItem(storageKey()) ?? 0) || 0;
  } catch {
    // Storage can be blocked (a private window, site data off): the list then starts at the top.
    return 0;
  }
}

function writeCarIndex(index: number) {
  try {
    window.sessionStorage.setItem(storageKey(), String(index));
  } catch {
    // Blocked storage only costs the restored scroll on Back.
    return;
  }
}

function subscribeToNothing() {
  return () => {
    // Nothing changes once the client has rendered.
  };
}

/**
 * False on the server and during hydration, true from the first client render
 * on: the render in which the media queries (useIsPhone, useSavedColumns) read
 * the window instead of reporting their server default.
 */
function useClientResolved(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * A removed car, drawn once more where it was while it fades out (SAVED-14).
 * It is not one of the shown cars: it is `inert` and `aria-hidden`, and the
 * cars after it move up under it at once, so no car is ever reachable twice.
 */
export interface LeavingCar {
  key: string;
  listing: CarListing;
  /** Its row's offset from the list's top, as the virtualiser drew it. */
  top: number;
  /** Its column in that row, from 0. */
  column: number;
}

interface SavedListOptions {
  /** How many cars are shown. */
  count: number;
  /** Cards per row (useSavedColumns): 1 on the phone, 2 from `lg`, 3 from `xl`. */
  columns: SavedColumns;
  /** The ids of the cars shown: a car shown again drops its leaving entry. */
  shownIds: ReadonlySet<string>;
  /** A row's key: the car's own id on the phone, so its row keeps its element (and focus) as rows around it come and go. */
  rowKey: (row: number) => string | number;
}

export function useSavedList({ count, columns, shownIds, rowKey }: SavedListOptions) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // The row holding the focus: while it is near the view, it and the rows on
  // each side stay mounted, so Tab always finds the next car in the DOM even
  // before the scroll its focus caused has been read (SAVED-28).
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<LeavingCar[]>([]);
  const leavingSequence = useRef(0);
  // The cars an undo just brought back, which fade in as they mount (below).
  const [arriving, setArriving] = useState<ReadonlySet<string>>(NO_IDS);
  const resolved = useClientResolved();
  const width = columns === 1 ? "phone" : "desktop";
  const rowCount = Math.ceil(count / columns);

  // A car shown again (an undo, a failed removal put back) drops its leaving
  // entry, so it is never drawn twice and no stale entry fades out later.
  // Cleared while rendering, React's way to follow a changed prop.
  if (leaving.some((entry) => shownIds.has(entry.listing.id))) {
    setLeaving(leaving.filter((entry) => !shownIds.has(entry.listing.id)));
  }

  // An arriving car fades in as it mounts, in the commit that brings it back.
  // Once that commit is drawn the mark has done its work: a row the
  // virtualiser mounts later, while scrolling, draws its car at once.
  useLayoutEffect(() => {
    if (arriving.size > 0) setArriving(NO_IDS);
  }, [arriving]);

  // The rows kept around the focus count against SAVED-25's bound too, so they
  // are kept only while the focused row is near the view: inside the
  // overscanned range or one row past it, which is all Tab needs. Once the
  // scroll has taken it farther away, they are dropped like any other row.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const rows = defaultRangeExtractor(range);
      if (focusedRow === null) return rows;
      const nearest = Math.max(0, range.startIndex - range.overscan) - 1;
      const farthest = Math.min(range.count - 1, range.endIndex + range.overscan) + 1;
      if (focusedRow < nearest || focusedRow > farthest) return rows;
      const around = [focusedRow - 1, focusedRow, focusedRow + 1].filter(
        (row) =>
          row >= Math.max(0, nearest) &&
          row <= Math.min(rowCount - 1, farthest) &&
          !rows.includes(row),
      );
      return [...rows, ...around].sort((a, b) => a - b);
    },
    [focusedRow, rowCount],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ESTIMATE[width],
    gap: GAP[width],
    overscan: OVERSCAN[width],
    scrollMargin,
    getItemKey: rowKey,
    rangeExtractor,
  });

  // The rows start under the heading and the chips, which scroll with them;
  // their height changes with the width, so it is read after every render.
  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  });

  // SAVED-27: on mount, back to the car that was first wholly in view when
  // this history entry was left, in the row it sits in at the current column
  // count. Only once the client's media queries have resolved: the hydration
  // render reports two columns whatever the width. The virtualiser keeps
  // correcting the jump while the rows above are measured. The jump waits a
  // frame: the virtualiser puts its element back at its own offset when it
  // attaches (twice in React's development double mount), which would undo a
  // jump made before.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || count === 0 || !resolved) return;
    const index = readCarIndex();
    const frame = window.requestAnimationFrame(() => {
      restoredRef.current = true;
      if (index > 0) virtualizer.scrollToIndex(Math.floor(index / columns), { align: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [virtualizer, count, columns, resolved]);

  // The focus leaving the list (to the map, the header, the car sheet) frees
  // the rows it kept mounted, so the mounted count stays within SAVED-25's
  // bound. Read on the scrolling column, which is drawn once the client has
  // resolved, while the list itself comes and goes with the empty state.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!resolved || !scroller) return;
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && listRef.current?.contains(next)) return;
      setFocusedRow(null);
    };
    scroller.addEventListener("focusout", onFocusOut);
    return () => scroller.removeEventListener("focusout", onFocusOut);
  }, [resolved]);

  /** Records the first car wholly in view, for Back (SAVED-27). */
  const recordScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop;
    const item = virtualizer.getVirtualItemForOffset(top);
    if (!item) return;
    const row = item.start >= top - 1 ? item.index : item.index + 1;
    writeCarIndex(row * columns);
  }, [virtualizer, columns]);

  /** Brings the car at `index` (in the shown order) wholly into view (SAVED-26). */
  const scrollToCar = useCallback(
    (index: number) => {
      if (index < 0) return;
      virtualizer.scrollToIndex(Math.floor(index / columns), {
        align: "auto",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [virtualizer, columns],
  );

  /**
   * The car at `index` (in the shown order before its removal) was removed:
   * if its row is drawn, it fades out there. A row out of view has nothing to
   * fade.
   */
  const markLeaving = useCallback(
    (listing: CarListing, index: number) => {
      const row = Math.floor(index / columns);
      const drawn = virtualizer.getVirtualItems().find((item) => item.index === row);
      if (!drawn) return;
      leavingSequence.current += 1;
      const entry: LeavingCar = {
        key: `${listing.id}:${leavingSequence.current}`,
        listing,
        top: drawn.start - scrollMargin,
        column: index % columns,
      };
      // A car has one leaving entry at most: a newer removal replaces it.
      setLeaving((current) => [
        ...current.filter((other) => other.listing.id !== listing.id),
        entry,
      ]);
    },
    [virtualizer, columns, scrollMargin],
  );

  /** A leaving car's fade ended: it goes. */
  const leftList = useCallback((key: string) => {
    setLeaving((current) => current.filter((entry) => entry.key !== key));
  }, []);

  /** An undo brings this car back: it fades in where it lands (SAVED-15, SAVED-22). */
  const markArriving = useCallback((listingId: string) => {
    setArriving((current) => new Set([...current, listingId]));
  }, []);

  return {
    /** False until the client's media queries have resolved (useClientResolved). */
    resolved,
    scrollerRef,
    listRef,
    virtualizer,
    scrollMargin,
    recordScroll,
    scrollToCar,
    leaving,
    markLeaving,
    leftList,
    arriving,
    markArriving,
    /** A row took the focus. */
    focusRow: setFocusedRow,
  };
}
