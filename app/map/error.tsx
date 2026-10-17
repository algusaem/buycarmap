"use client";

import { useTranslations } from "next-intl";
import { PageError } from "@/components/ui/PageError";

// docs/specs/redesign-map.md (MAPUI-34): /map's own error boundary, the
// page-error state (components/ui/PageError.tsx) with the map's own line and
// «Reintentar», which retries the route. The board's second action, «Volver
// al mapa», is left out: this is the map.
interface MapErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MapError({ error, reset }: MapErrorProps) {
  const t = useTranslations();

  return (
    <main className="flex flex-1 flex-col px-5 pt-10 lg:px-8 lg:pt-21.5">
      <PageError error={error} reset={reset} line={t("mapStates.pageErrorLine")} />
    </main>
  );
}
