"use client";

import { type ReactNode, useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouteRetry } from "@/lib/hooks/useRouteRetry";

// The page-error state of docs/design/canvas/F0-estado-error-pagina.dc.html,
// which a route's `error.tsx` renders inside its own frame: /map
// (docs/specs/redesign-map.md, MAPUI-34) and /favorites
// (docs/specs/redesign-saved.md, SAVED-32). «¿Se ha roto algo? / No es culpa
// tuya» is the page's `h1`, since nothing else on the page renders, over the
// page's own line, then «Reintentar», which refreshes the route's server data
// and resets the boundary (PLAT-14), and any further action the page adds.
// The thrown error is never shown; it is reported to Sentry here, since
// `onRequestError` in instrumentation.ts only sees server errors.

interface PageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** The line under the headline. */
  line: string;
  /** Actions after «Reintentar» («Volver al mapa» on /favorites). */
  children?: ReactNode;
}

export function PageError({ error, reset, line, children }: PageErrorProps) {
  const t = useTranslations();
  const retry = useRouteRetry(reset);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <EmptyState
      headingLevel="h1"
      question={t("errors.pageTitle")}
      punchline={t("errors.pagePunchline")}
      line={line}
    >
      <Button type="button" variant="primary" size="48" onClick={retry}>
        {t("errors.retry")}
      </Button>
      {children}
    </EmptyState>
  );
}
