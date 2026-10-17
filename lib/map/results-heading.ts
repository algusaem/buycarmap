import type { LocaleCopy } from "@/lib/i18n/copy";

// docs/specs/redesign-map.md (MAPUI-33). The desktop list's title and the
// phone results sheet's title (MAPUI-23) are the same string, built from this
// one pure function. Upper case, like the spec's worked examples; the text
// comes from `mapStates.*` in the locale of `copy`.
//
// Whether the next page is still loading ("load-more running") is
// deliberately not a fourth status: the worked example's last two rows are
// identical text for the same (count, hasMore) pair, so a separate flag would
// add a branch with no observable effect.
export interface ResultsHeadingState {
  status: "loading" | "error" | "ready";
  count: number;
  hasMore: boolean;
}

export function resultsHeading(
  { status, count, hasMore }: ResultsHeadingState,
  { t }: LocaleCopy,
): string {
  if (status === "loading") return t("mapStates.headingLoading");
  if (status === "error") return t("mapStates.headingError");
  if (hasMore) return t("mapStates.headingMore", { count });
  if (count === 0) return t("mapStates.headingNone");
  return t("mapStates.headingCount", { count });
}
