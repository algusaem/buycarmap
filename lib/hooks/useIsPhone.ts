import { useSyncExternalStore } from "react";

// docs/specs/redesign-map.md (MAPUI-23, MAPUI-24, MAPUI-29): below Tailwind's
// `lg` (64rem) the map page behaves as the phone design — the results sheet
// slices its cards by position, a pin moves the sheet instead of opening the
// preview, and there is no zoom control. The layout itself is CSS; this only
// tells the map page which behaviour applies. The server, and any first
// render, assume desktop.
const PHONE_QUERY = "(width < 64rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
