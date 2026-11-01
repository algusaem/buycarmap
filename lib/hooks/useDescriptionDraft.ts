import { useState } from "react";

// docs/specs/map-description-search.md (Key DESC): the filter row's
// description field (components/map/filters/DescriptionField.tsx) shows what
// is typed and applies it on Enter or «Borrar texto» (DESC-6, DESC-9). The
// draft resets to `applied` the same render it changes from outside — a
// deep-linked `q`, Back/Forward, or a discarded draft (DESC-15) — rather
// than in an effect, so there is no remount and no flash of stale text.
// `resetKey` lets a caller force that same reset (Back/Forward, «Borrar»,
// «Quitar filtros»; DESC-15, DESC-19) without `applied` itself changing.
export function useDescriptionDraft(applied: string, resetKey?: number) {
  const [value, setValue] = useState(applied);
  const [seen, setSeen] = useState({ applied, resetKey });
  if (seen.applied !== applied || seen.resetKey !== resetKey) {
    setSeen({ applied, resetKey });
    setValue(applied);
  }
  const trimmed = value.trim();
  // DESC-4: violet once the shown text is exactly what is applied — typing
  // over it without pressing Enter yet reads as the plain, unapplied border.
  const isApplied = applied !== "" && trimmed === applied;

  return { value, setValue, trimmed, isApplied };
}
