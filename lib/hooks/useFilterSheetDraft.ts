import { useState } from "react";
import { orderedKm, panelCriteria } from "@/lib/search/panel";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-18, MAPUI-21, MAPUI-22): the phone
// filters sheet's draft (components/map/filters/FilterPanel.tsx). Choices stay
// in the draft until «Ver coches» hands them over (`criteria`); «Borrar» only
// empties the draft, and once applied it also drops the landing's `?q=` text.
// MAPUI-74: «Kilómetros»'s Mínimo and Máximo apply independently as typed
// (MAPUI-21), so a minimum above the maximum is only swapped here, once,
// rather than on every edit.

/**
 * Every criterion «Borrar» clears, including the ones the UI no longer
 * offers (MAPUI-18; lib/search/panel.ts's PANEL_KEYS).
 */
const PANEL_CLEARED = panelCriteria({});

export function useFilterSheetDraft(input: SearchInput) {
  const [draft, setDraft] = useState<SearchInput>(input);
  const [textCleared, setTextCleared] = useState(false);

  function edit(patch: Partial<SearchInput>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function clear() {
    setDraft((current) => ({ ...current, ...PANEL_CLEARED }));
    setTextCleared(true);
  }

  /**
   * What «Ver coches» hands over: every panel criterion — the mileage ends
   * swapped if needed (MAPUI-74) — and an emptied `?q=` after «Borrar».
   */
  function criteria(): Partial<SearchInput> {
    const resolved = { ...draft, ...orderedKm(draft) };
    if (textCleared) return { ...panelCriteria(resolved), keywords: "" };
    return panelCriteria(resolved);
  }

  return { draft, edit, clear, criteria };
}
