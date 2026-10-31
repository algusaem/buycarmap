import { useState } from "react";
import { orderedKm } from "@/lib/search/panel";
import type { SearchInput } from "@/lib/search/schema";

type Mileage = Pick<SearchInput, "minKm" | "maxKm">;

// docs/specs/redesign-map.md (MAPUI-73, MAPUI-74): «Kilómetros»'s desktop
// draft (components/map/search/MileageRange.tsx's MileageRange). Like
// useCriterionDraft, but over both boxes at once — a minimum above the
// maximum, or the reverse, swaps with it on blur or Enter of either box
// (lib/search/panel.ts's `orderedKm`), so the two drafts have to be read
// together rather than committed independently. The draft follows the
// criteria when they change outside (a quick filter, «Borrar»).
export function useMileageDraft(value: Mileage, onChange: (patch: Mileage) => void) {
  const [draft, setDraft] = useState<Mileage>(value);
  const [synced, setSynced] = useState<Mileage>(value);
  if (value.minKm !== synced.minKm || value.maxKm !== synced.maxKm) {
    setSynced(value);
    setDraft(value);
  }

  function setMinDraft(minKm: number | undefined) {
    setDraft((current) => ({ ...current, minKm }));
  }

  function setMaxDraft(maxKm: number | undefined) {
    setDraft((current) => ({ ...current, maxKm }));
  }

  function commit() {
    const ordered = orderedKm(draft);
    if (ordered.minKm !== value.minKm || ordered.maxKm !== value.maxKm) onChange(ordered);
  }

  return { minDraft: draft.minKm, setMinDraft, maxDraft: draft.maxKm, setMaxDraft, commit };
}
