"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouteRetry } from "@/lib/hooks/useRouteRetry";

// docs/specs/redesign-map.md (MAPUI-34): /map's own error boundary, the
// page-error state of docs/design/canvas/F0-estado-error-pagina.dc.html
// («¿Se ha roto algo? / No es culpa tuya») with the map's own line and
// «Reintentar», which retries the route. Its headline is the page's `h1`:
// nothing else on the page is rendered. The board's second action, «Volver al mapa», is left out: this is
// the map. The thrown error is reported to Sentry here: `onRequestError` in
// instrumentation.ts only sees server errors.
interface MapErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MapError({ error, reset }: MapErrorProps) {
  const t = useTranslations();
  const retry = useRouteRetry(reset);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col px-5 pt-10 lg:px-8 lg:pt-21.5">
      <EmptyState
        headingLevel="h1"
        question={t("errors.pageTitle")}
        punchline={t("errors.pagePunchline")}
        line={t("mapStates.pageErrorLine")}
      >
        <Button type="button" variant="primary" size="48" onClick={retry}>
          {t("errors.retry")}
        </Button>
      </EmptyState>
    </main>
  );
}
