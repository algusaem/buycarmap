import { useState } from "react";

// docs/specs/redesign-map.md (MAPUI-14): the draft of one of the filters
// panel's number boxes, «Kilómetros, hasta» and «Año, desde»
// (components/map/filters/FilterPanel.tsx). The box shows what is typed and
// applies it on `commit` (the box losing focus, or Enter): an emptied box
// clears the criterion. Text NumberBox itself cannot read («abc», «-5»,
// «1.2.3x») never reaches `setDraft` to begin with, so there is nothing left
// here to refuse — parsing is the only gate (the schema accepts every whole
// number of 0 or more). The draft follows the criterion when it changes
// outside (a removed chip, «Borrar»).
export function useCriterionDraft(
  value: number | undefined,
  onCommit: (value: number | undefined) => void,
) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  function commit() {
    if (draft !== value) onCommit(draft);
  }

  return { draft, setDraft, commit };
}
