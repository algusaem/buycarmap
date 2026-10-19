import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { filterChips } from "@/lib/search/filter-chips";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-13, MAPUI-64, MAPUI-67). «Filtros»'s
// active-criteria count, shared by the desktop row (FilterRow.tsx) and the
// phone band (PhoneSearchBar.tsx): lib/search/filter-chips.ts's filterChips
// length, plus the sr-only description's id (`useId`) that FiltersBadge
// hands to both buttons' `aria-describedby`.

export interface FilterCount {
  count: number;
  descriptionId: string;
  describedBy: string | undefined;
}

export function useFilterCount(input: SearchInput): FilterCount {
  const t = useTranslations();
  const locale = useLocale();
  const descriptionId = useId();
  const count = filterChips(input, { t, locale }).length;

  return { count, descriptionId, describedBy: count > 0 ? descriptionId : undefined };
}
