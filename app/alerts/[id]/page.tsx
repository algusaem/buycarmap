import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertPage } from "@/components/alerts/AlertPage";
import { getAlertWithMatches } from "@/server/alerts/queries";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

interface PageProps {
  params: Promise<{ id: string }>;
}

// The title and the page read the same alert once per request.
const readAlert = cache(getAlertWithMatches);

// docs/specs/redesign-alerts.md (ALERTUI-20): «<nombre de la alerta> · Buy Car Map».
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [alert, t] = await Promise.all([readAlert(id), getTranslations()]);
  return { title: `${alert.label} · ${t("meta.title")}` };
}

// docs/specs/redesign-alerts.md (ALERTUI-20, ALERTUI-22, ALERTUI-45): one of
// the user's alerts with every match, newest first. Authenticates first;
// another account's alert, a deleted, an unknown or a malformed id is a 404
// (getAlertWithMatches). The matches render from their stored snapshot, so
// the page works with every source unreachable (ALERT-39). The page does not
// scroll; its list column does (ALERTUI-4), with every toast centred over it
// (`data-toast-anchor`, ALERTUI-37).
export default async function AlertMatchesPage({ params }: PageProps) {
  const { id } = await params;
  const alert = await readAlert(id);

  return (
    <main
      {...MAIN_CONTENT}
      data-toast-anchor="alerts"
      className="outline-none flex min-h-0 flex-1 flex-col bg-background"
    >
      <AlertPage alert={alert} />
    </main>
  );
}
