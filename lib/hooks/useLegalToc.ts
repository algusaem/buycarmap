import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/animations";
import { useIsPhone } from "@/lib/hooks/useIsPhone";

// docs/specs/redesign-pages.md (PAGES-62, PAGES-63, PAGES-64);
// docs/design/system/components/LegalToc/README.md. The legal pages' index:
// which section is on screen, whether the phone index is open, and the jump
// to a section's heading.

/**
 * A heading at most this far under the top of the scrolling box is the one
 * being read: the 30px a jump leaves above it (its `scroll-margin-top`) and
 * some room for rounding.
 */
const READING_LINE = 64;

interface LegalTocState {
  /** The page's scrolling box, holding the text and the footer. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Re-reads the section on screen; the scrolling box's `onScroll`. */
  onScroll: () => void;
  /** The id of the section on screen, marked `aria-current="location"`. */
  current: string;
  /** Whether the phone index is open; the desktop index is always shown. */
  open: boolean;
  /** Whether the list is drawn: always at desktop width, when open on a phone. */
  showList: boolean;
  /**
   * Whether CSS folds the list below `lg`: until the phone width is known (the
   * server and the first render assume desktop), so a phone never flashes it
   * open; once known, the list leaves through its exit animation instead.
   */
  foldWithCss: boolean;
  toggle: () => void;
  /** Goes to a section: scrolls to its heading and folds the phone index. */
  select: (id: string) => void;
  /** The phone list's exit is over: the deferred jump runs once the list has left the page. */
  onListExitComplete: () => void;
}

function jumpTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  // The address names the section, as a plain anchor would (RULES.md §19).
  window.history.pushState(null, "", `#${id}`);
}

export function useLegalToc(firstId: string): LegalTocState {
  const isPhone = useIsPhone();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingJump = useRef<string | undefined>(undefined);
  const [jumpAfterFold, setJumpAfterFold] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(firstId);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const headings = Array.from(scroller.querySelectorAll<HTMLElement>("h2[id]"));
    const last = headings.at(-1);
    if (!last) return;

    // The last sections may never reach the line: at the end of the text, the
    // last one is the one being read.
    const atEnd =
      scroller.scrollTop > 0 &&
      Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
    if (atEnd) {
      setCurrent(last.id);
      return;
    }

    const line = scroller.getBoundingClientRect().top + READING_LINE;
    const read = headings.filter((heading) => heading.getBoundingClientRect().top <= line).at(-1);
    setCurrent(read?.id ?? firstId);
  }, [firstId]);

  // A deep link (`/privacy#cookies`) opens already scrolled: mark its section
  // on the first paint, before any scroll event.
  useEffect(() => {
    onScroll();
  }, [onScroll]);

  const select = useCallback(
    (id: string) => {
      setOpen(false);
      // Folding the phone list shortens the page above the heading, so the
      // jump waits for the list to leave.
      if (isPhone && open) {
        pendingJump.current = id;
        return;
      }
      jumpTo(id);
    },
    [isPhone, open],
  );

  const onListExitComplete = useCallback(() => {
    const id = pendingJump.current;
    pendingJump.current = undefined;
    // The exit is over, but the list leaves the page on the render that
    // follows. Setting state here lands in that same render, so the effect
    // below jumps once it is committed: the list is gone and the page is its
    // final height. A next-frame timer could fire before that render under
    // load, and scroll with the list still drawn (#137).
    if (id) setJumpAfterFold(id);
  }, []);

  useEffect(() => {
    if (!jumpAfterFold) return;
    jumpTo(jumpAfterFold);
    setJumpAfterFold(undefined);
  }, [jumpAfterFold]);

  return {
    scrollerRef,
    onScroll,
    current,
    open,
    showList: !isPhone || open,
    foldWithCss: !isPhone && !open,
    toggle: () => setOpen((wasOpen) => !wasOpen),
    select,
    onListExitComplete,
  };
}
