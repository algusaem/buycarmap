import { useState } from "react";
import { panelCriteria } from "@/lib/search/panel";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-map.md (MAPUI-18, MAPUI-21, MAPUI-22): the phone
// filters sheet's draft (components/map/filters/FilterPanel.tsx). Choices stay
// in the draft until «Ver coches» hands them over (`criteria`); «Borrar» only
// empties the draft, and once applied it also drops the Descripción text.

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

  /** What «Ver coches» hands over: every panel criterion, and an emptied Descripción text after «Borrar». */
  function criteria(): Partial<SearchInput> {
    if (textCleared) return { ...panelCriteria(draft), keywords: "" };
    return panelCriteria(draft);
  }

  return { draft, edit, clear, criteria };
}
