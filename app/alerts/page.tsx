import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertsPage } from "@/components/alerts/AlertsPage";
import { listAlertsForPage } from "@/server/alerts/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("alerts.title")} · ${t("meta.title")}` };
}

interface AlertsRouteProps {
  /** The open alert, `alert` (docs/specs/redesign-alerts.md, ALERTUI-12). */
  searchParams: Promise<{ alert?: string | string[] }>;
}

/** The URL's `alert`, or none: a repeated parameter reads as its first value. */
function requestedAlert(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// docs/specs/redesign-alerts.md (ALERTUI-1, ALERTUI-2, ALERTUI-12,
// ALERTUI-44): the user's alerts and the open one's matches, read on the
// server for the URL's `alert`. No back link: the way back is the header's
// «Mapa» and the tab bar's. The page does not scroll; its list column does
// (ALERTUI-4). `data-toast-anchor`: every toast here is centred over that
// column (ALERTUI-37, amends SAVED-24; app/globals.css). The page's `main`,
// as its loading and error states'.
export default async function AlertsRoute({ searchParams }: AlertsRouteProps) {
  const { alert } = await searchParams;
  const page = await listAlertsForPage(requestedAlert(alert));

  return (
    <main data-toast-anchor="alerts" className="flex min-h-0 flex-1 flex-col bg-background">
      <AlertsPage {...page} />
    </main>
  );
}
