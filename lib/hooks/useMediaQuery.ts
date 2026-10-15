import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether `query` matches, kept in step with the window. The server, and any
 * first render, report false. `useIsPhone` is this with the phone query; the
 * saved cars' grid reads its column count from it (docs/specs/redesign-saved.md,
 * SAVED-3).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
