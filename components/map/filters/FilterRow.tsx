"use client";

import type { ComponentProps, ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatedPopover } from "@/components/map/search/AnimatedPopover";
import { closeListboxFirst } from "@/components/map/search/Combobox";
import { useFilterCount } from "@/lib/hooks/useFilterCount";
import type { SearchInput } from "@/lib/search/schema";
import { cn } from "@/lib/utils";
import { FiltersBadge } from "./FiltersBadge";
import { QuickFilters } from "./QuickFilters";

// docs/specs/redesign-map.md (MAPUI-13, MAPUI-19, MAPUI-58, MAPUI-59);
// docs/design/system/components/Chip/README.md. The desktop map header's
// second row: «Filtros», 34px like the toggles beside it, with a violet badge
// counting the active criteria (lib/search/filter-chips.ts's filterChips;
// none shows no badge, and the badge fades in and out), a 1px divider, then
// the quick filters (QuickFilters), whose patches go to `onApplyQuick`.
//
// The filters panel (FilterPanel) is a dropdown anchored under «Filtros»
// (MAPUI-19): it arrives through `panel` and is open while `panelOpen`. On a
// phone «Filtros» is the round button beside the summary instead
// (PhoneSearchBar, MAPUI-62).
export interface FilterRowProps {
  input: SearchInput;
  onOpenFilters: () => void;
  onApplyQuick: (patch: Partial<SearchInput>) => void;
  panel: ReactNode;
  panelOpen: boolean;
  onClosePanel: () => void;
}

export function FilterRow({
  input,
  onOpenFilters,
  onApplyQuick,
  panel,
  panelOpen,
  onClosePanel,
}: FilterRowProps) {
  const t = useTranslations();
  const { count, descriptionId, describedBy } = useFilterCount(input);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <AnimatedPopover
        open={panelOpen}
        onOpenChange={(open) => (open ? onOpenFilters() : onClosePanel())}
        trigger={
          <FiltersButton count={count} descriptionId={descriptionId} describedBy={describedBy} />
        }
        content={panel}
        ariaLabel={t("map.filters")}
        onEscapeKeyDown={closeListboxFirst}
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="z-50 flex max-h-filters-max w-115 flex-col overflow-hidden rounded-card border border-line bg-surface font-sans text-text shadow-float"
      />
      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-line" />
      <QuickFilters input={input} onApply={onApplyQuick} />
    </div>
  );
}

interface FiltersButtonProps extends ComponentProps<"button"> {
  /** The active criteria, counted in the violet badge; none shows no badge. */
  count: number;
  descriptionId: string;
  describedBy: string | undefined;
}

/** «Filtros» with its badge, the desktop dropdown's trigger. Named
 * `map.filters` alone, as the phone's own button is (PhoneSearchBar.tsx):
 * the visible «Filtros» text is kept, but the name is pinned with
 * `aria-label` because an unlabelled button's name would otherwise also
 * pick up the sr-only description's text. The badge is `aria-hidden` and an
 * `aria-describedby` sr-only span carries the count to assistive tech
 * instead. */
function FiltersButton({
  count,
  descriptionId,
  describedBy,
  className,
  ...props
}: FiltersButtonProps) {
  const t = useTranslations();

  return (
    <button
      type="button"
      {...props}
      aria-label={t("map.filters")}
      aria-describedby={describedBy}
      className={cn(
        "flex h-8.5 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-pill border border-line px-3.5 font-sans text-small font-bold text-text",
        className,
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      {t("map.filters")}
      <FiltersBadge count={count} descriptionId={descriptionId} />
    </button>
  );
}
