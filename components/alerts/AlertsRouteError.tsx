"use client";

import { useTranslations } from "next-intl";
import { SavedRouteError } from "@/components/favorites/SavedLayout";

// docs/specs/redesign-alerts.md (ALERTUI-42; amends PLAT-14);
// F0-estado-error-pagina. The two alert routes' `error.tsx`: /favorites'
// route error (SAVED-32), the page-error state in the list column, with the
// empty alert map, «Mapa de la alerta», beside it at desktop width: no zone,
// no pin and no pill. The thrown error is never shown.

interface AlertsRouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function AlertsRouteError({ error, reset }: AlertsRouteErrorProps) {
  const t = useTranslations();

  return <SavedRouteError error={error} reset={reset} mapLabel={t("alerts.mapLabel")} />;
}
