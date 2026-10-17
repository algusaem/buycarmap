import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";

// docs/design/system/components/SearchPopover/README.md (Teclado): a
// combobox's keyboard over its listbox — the arrows move the highlighted
// option, wrapping at the ends, and Enter chooses it. The field keeps the
// focus; the highlighted option is its `aria-activedescendant`.
//
// Escape, or a press outside `containerRef` (the field and its list), closes
// the list without choosing (MAP-20); the popover or sheet around it stays
// open, and closes on a second Escape (MAPUI-2, MAPUI-21). ArrowDown, or a
// `reset()` once the text changes or a choice is made, shows it again.
// `open` is whether the list shows: there are options and it was not closed.
// `listboxId` names the listbox, `optionId(index)` each option, and
// `activeDescendant` is the field's `aria-activedescendant`: the highlighted
// option while the list shows.
export function useOptionNavigation(count: number, choose: (index: number) => void) {
  const [highlighted, setHighlighted] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const open = count > 0 && !dismissed;
  const optionId = (index: number) => `${listboxId}-${index}`;
  const activeDescendant = open && highlighted >= 0 ? optionId(highlighted) : undefined;

  // Stable, so the press-outside effect below can call it.
  const dismiss = useCallback(() => {
    setDismissed(true);
    setHighlighted(-1);
  }, []);

  /** Shows the list again with nothing highlighted: after typing or a choice. */
  function reset() {
    setDismissed(false);
    setHighlighted(-1);
  }

  useEffect(() => {
    if (!open) return;
    function closeOnPressOutside(event: MouseEvent) {
      const container = containerRef.current;
      // A caller that draws no container gives no outside to press.
      if (!container) return;
      if (event.target instanceof Node && container.contains(event.target)) return;
      dismiss();
    }
    document.addEventListener("mousedown", closeOnPressOutside);
    return () => document.removeEventListener("mousedown", closeOnPressOutside);
  }, [open, dismiss]);

  /** The keys over a showing list: the arrows move, wrapping; Enter chooses. */
  function moveOrChoose(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => (index + 1) % count);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => (index <= 0 ? count - 1 : index - 1));
    }
    if (event.key === "Enter" && highlighted >= 0 && highlighted < count) {
      event.preventDefault();
      choose(highlighted);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) dismiss();
      return;
    }
    if (count === 0) return;
    if (event.key === "ArrowDown" && dismissed) {
      event.preventDefault();
      setDismissed(false);
      return;
    }
    if (open) moveOrChoose(event);
  }

  return {
    highlighted,
    setHighlighted,
    onKeyDown,
    open,
    reset,
    containerRef,
    listboxId,
    optionId,
    activeDescendant,
  };
}
