import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

// docs/specs/redesign-saved.md (SAVED-3): how many Guardados cards a row of
// the saved list holds. Three from 80rem (`xl`, the 830px column), two from
// `lg` (the 546px column), and one compact row on the phone. The server, and
// any first render, see two: both media queries report false until the client
// reads them.

export type SavedColumns = 1 | 2 | 3;

export function useSavedColumns(): SavedColumns {
  const isPhone = useIsPhone();
  const wide = useMediaQuery("(width >= 80rem)");
  if (isPhone) return 1;
  return wide ? 3 : 2;
}
