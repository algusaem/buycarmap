import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

// docs/specs/redesign-map.md (MAPUI-23, MAPUI-24, MAPUI-29): below Tailwind's
// `lg` (64rem) the map page behaves as the phone design — the results sheet
// slices its cards by position, a pin moves the sheet instead of opening the
// preview, and there is no zoom control. /favorites switches between its
// desktop and phone compositions on the same boundary (SAVED-2, SAVED-3). The
// layout itself is CSS; this only tells a page which behaviour applies. The
// server, and any first render, assume desktop.
const PHONE_QUERY = "(width < 64rem)";

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
