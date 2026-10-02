"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  reset: () => void;
}

/**
 * Shared `error.tsx` boundary for /favorites, /alerts and /alerts/[id]
 * (PLAT-14, docs/specs/core-platform.md): a translated message and a retry
 * button that refreshes the route's server data and resets the boundary,
 * instead of the page silently rendering an empty list on a failed read
 * (issue #48).
 *
 * The thrown error itself is deliberately unused — Sentry captures it
 * (instrumentation.ts's `onRequestError`), and showing it to the visitor
 * would leak internal detail for no benefit.
 */
export function RouteError({ reset }: RouteErrorProps) {
  const t = useTranslations();
  const router = useRouter();

  function retry() {
    // `reset()` alone re-renders the boundary's children with the same
    // server data that just failed — a request that failed because the data
    // itself errored would fail identically again. `router.refresh()` reruns
    // the server request first, so a transient failure actually gets a fresh
    // attempt.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t("errors.pageLoadFailed")}</p>
      <Button onClick={retry}>{t("errors.retry")}</Button>
    </div>
  );
}
