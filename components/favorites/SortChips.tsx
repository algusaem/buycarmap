"use client";

import { useTranslations } from "next-intl";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { SAVED_SORTS, type SavedSort } from "@/lib/favorites/sort";

// docs/specs/redesign-saved.md (SAVED-6); docs/design/system/components/Chip/README.md
// › Orden: «Recientes · Precio · Km», three `aria-pressed` chips, exactly one
// pressed. Desktop only: the phone has no sort (SAVED-8).

const LABEL_KEY: Record<SavedSort, string> = {
  recent: "favorites.sortRecent",
  price: "favorites.sortPrice",
  km: "favorites.sortKm",
};

interface SortChipsProps {
  sort: SavedSort;
  /** Left out where the chips are only drawn, as in the loading state. */
  onChange?: (sort: SavedSort) => void;
}

export function SortChips({ sort, onChange }: SortChipsProps) {
  const t = useTranslations();

  return (
    <div className="flex gap-2 max-lg:hidden">
      {SAVED_SORTS.map((value) => (
        <ToggleChip
          key={value}
          label={t(LABEL_KEY[value])}
          active={sort === value}
          onClick={() => onChange?.(value)}
        />
      ))}
    </div>
  );
}
