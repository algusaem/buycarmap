"use client";

import { useLocale, useTranslations } from "next-intl";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { formatMileage } from "@/lib/format";
import {
  isQuickFilterOn,
  QUICK_FILTERS,
  QUICK_MAX_KM,
  type QuickFilterKey,
  toggleQuickFilter,
} from "@/lib/search/quick-filters";
import type { SearchInput } from "@/lib/search/schema";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-63); docs/design/system/components/Chip/
// README.md. The quick filters row: a group (a fieldset, the native element
// for role="group"; `min-w-0` undoes its min-content width, so it can scroll
// sideways on a phone) named «Filtros rápidos» holding the five 34px toggles
// in QUICK_FILTERS order. Each reads the current search
// (lib/search/quick-filters.ts's isQuickFilterOn) and, pressed, hands the
// patch toggleQuickFilter returns to `onApply`, which applies it at once.
// A toggle that takes focus is brought fully into the row's visible part at
// once, so the phone row never leaves a focused chip clipped (A11Y-4).
export interface QuickFiltersProps {
  input: SearchInput;
  onApply: (patch: Partial<SearchInput>) => void;
  className?: string;
}

export function QuickFilters({ input, onApply, className }: QuickFiltersProps) {
  const t = useTranslations();
  const locale = useLocale();

  const labels: Record<QuickFilterKey, string> = {
    gasoline: t("filters.fuelGroups.gasoline"),
    gasoil: t("filters.fuelGroups.gasoil"),
    manual: t("filters.transmissions.manual"),
    automatic: t("filters.transmissions.automatic"),
    maxKm100k: t("filters.maxKmChip", { km: formatMileage(QUICK_MAX_KM, locale) }),
  };

  return (
    <fieldset
      aria-label={t("map.quickFilters")}
      onFocus={(event) =>
        event.target.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" })
      }
      className={cn("flex min-w-0 scroll-px-2 gap-2", className)}
    >
      {QUICK_FILTERS.map((key) => (
        <ToggleChip
          key={key}
          size="quick"
          label={labels[key]}
          active={isQuickFilterOn(input, key)}
          onClick={() => onApply(toggleQuickFilter(input, key))}
        />
      ))}
    </fieldset>
  );
}
