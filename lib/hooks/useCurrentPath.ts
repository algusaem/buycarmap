import { usePathname, useSearchParams } from "next/navigation";

/**
 * The current path with its query, «/map?make=Toyota&maxPrice=20000»: where
 * a signed-out buyer comes back to after signing in, so the search survives
 * it (docs/specs/redesign-map.md MAPUI-37, MAPUI-46).
 */
export function useCurrentPath(): string {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return query ? `${pathname}?${query}` : pathname;
}
