"use client";

import { type ComponentProps, type ReactNode, type Ref, useRef } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatedPopover } from "@/components/map/search/AnimatedPopover";
import { closeListboxFirst } from "@/components/map/search/Combobox";
import { crossFade } from "@/lib/animations";
import { type ChipKey, filterChips } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";
import { cn } from "@/lib/utils";
import { RemovableChip } from "./RemovableChip";

// docs/specs/redesign-map.md (MAPUI-13); docs/design/system/components/Chip/
// README.md. «Filtros», with a violet badge counting the active chips, then
// one violet chip per lib/search/filter-chips.ts's filterChips(input), each
// with its 44px remove button (RemovableChip). With nothing active, «Filtros»
// has no badge. The badge and the chips fade in and out.
//
// On desktop the filters panel (FilterPanel) is a dropdown anchored under
// «Filtros» (MAPUI-19): it arrives through `panel` and is open while
// `panelOpen`. Over the phone map (`overMap`), «Filtros» takes the `surface`
// fill and the row scrolls sideways instead of wrapping; there it opens the
// full-screen filters dialog, so it is a plain button announcing that dialog
// (`aria-haspopup`, `aria-expanded` while `panelOpen`), and `filtersRef`
// lets the dialog give the focus back to it on close. The sideways scroller
// clips at its padding box, so it pads 8px above and below (taken back with
// a negative margin): room for the 2px focus ring at 3px off «Filtros» and
// off the remove buttons, which reach 4px past their chips.
export interface FilterRowProps {
  input: SearchInput;
  onRemove: (key: ChipKey) => void;
  onOpenFilters: () => void;
  panel?: ReactNode;
  panelOpen?: boolean;
  onClosePanel?: () => void;
  overMap?: boolean;
  /** Over the phone map: «Filtros», where focus returns when the filters dialog closes. */
  filtersRef?: Ref<HTMLButtonElement>;
}

/** A ref callback that updates every given ref with the same node. */
function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

export function FilterRow({
  input,
  onRemove,
  onOpenFilters,
  panel,
  panelOpen = false,
  onClosePanel,
  overMap = false,
  filtersRef,
}: FilterRowProps) {
  const t = useTranslations();
  const locale = useLocale();
  const chips = filterChips(input, { t, locale });

  const chipButtonRefs = useRef(new Map<ChipKey, HTMLButtonElement | null>());
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  // Where focus goes once the removed chip's button is gone: the key of the
  // chip now standing where it stood, or "filters" when none is left. Found
  // before the removal, from this render's own chips; focused right after —
  // `flushSync` forces `onRemove`'s state update (lib/hooks/useSearchFilters.ts)
  // through a synchronous render first, so the target's own node (an
  // existing chip's, usually, not a freshly mounted one a ref callback could
  // catch) is already there to find in `chipButtonRefs` by the time this
  // reads it.
  function handleRemove(key: ChipKey) {
    const keys = chips.map((chip) => chip.key);
    const index = keys.indexOf(key);
    const remaining = keys.filter((current) => current !== key);
    const target =
      remaining.length === 0 ? "filters" : remaining[Math.min(index, remaining.length - 1)];
    flushSync(() => onRemove(key));
    if (target === "filters") filtersButtonRef.current?.focus();
    else chipButtonRefs.current.get(target)?.focus();
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {overMap && (
        <FiltersButton
          ref={mergeRefs(filtersRef, filtersButtonRef)}
          count={chips.length}
          overMap
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onClick={onOpenFilters}
        />
      )}
      {!overMap && (
        <AnimatedPopover
          open={panelOpen && panel != null}
          onOpenChange={(open) => (open ? onOpenFilters() : onClosePanel?.())}
          trigger={<FiltersButton ref={filtersButtonRef} count={chips.length} />}
          content={panel}
          ariaLabel={t("map.filters")}
          onEscapeKeyDown={closeListboxFirst}
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 flex max-h-filters-max w-115 flex-col overflow-hidden rounded-card border border-line bg-surface font-sans text-text shadow-float"
        />
      )}
      {/* The chips' own scroller, kept apart from «Filtros» so it stays fixed
          at the start while the chips slide behind it (MAPUI-13). The
          vertical padding, taken back with a negative margin, leaves room at
          every width for the focus ring and the 44px remove buttons that
          overflow-x-auto would otherwise clip vertically too. */}
      <div className="-my-2 flex min-w-0 items-center gap-2 overflow-x-auto py-2">
        <AnimatePresence initial={false}>
          {chips.map((chip) => (
            <RemovableChip
              key={chip.key}
              label={chip.label}
              onRemove={() => handleRemove(chip.key)}
              buttonRef={(node) => {
                chipButtonRefs.current.set(chip.key, node);
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface FiltersButtonProps extends ComponentProps<"button"> {
  /** The active chips, counted in the violet badge; none shows no badge. */
  count: number;
  overMap?: boolean;
}

/** «Filtros» with its badge: the desktop dropdown's trigger, or over the phone map the filters dialog's opener. */
function FiltersButton({ count, overMap = false, className, ...props }: FiltersButtonProps) {
  const t = useTranslations();

  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-pill border border-line px-4 py-2.5 font-sans text-sm font-bold text-text",
        // Fixed at the start of the row while the chips scroll past it
        // (MAPUI-13): the page background over the map's own bg-surface so
        // the chips read as passing behind it either way.
        overMap
          ? // Over the phone map it also keeps a 44px-tall hit area without
            // changing its drawn height (MAPUI-51), the same pseudo-element
            // technique as ToggleChip.
            "relative bg-surface before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2"
          : "bg-bg",
        className,
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      {t("map.filters")}
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span
            key="badge"
            {...crossFade}
            className="rounded-pill bg-violet px-2 py-px text-xs font-extrabold text-on-violet"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
