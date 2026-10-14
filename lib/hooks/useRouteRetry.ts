import { startTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The retry of a route's `error.tsx` boundary (PLAT-14,
 * docs/specs/core-platform.md; MAPUI-34, docs/specs/redesign-map.md).
 *
 * `reset()` alone re-renders the boundary's children with the same server
 * data that just failed — a request that failed because the data itself
 * errored would fail identically again. `router.refresh()` reruns the server
 * request first, so a transient failure actually gets a fresh attempt.
 */
export function useRouteRetry(reset: () => void): () => void {
  const router = useRouter();

  return () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
}
