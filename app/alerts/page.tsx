import type { Metadata } from "next";
import { TAB_BAR_CLEARANCE } from "@/components/nav/tab-bar-clearance";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listAlertsForPage } from "@/server/alerts/queries";
import { AlertsList } from "@/components/alerts/AlertsList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("alerts.title")} · ${t("meta.title")}` };
}

export default async function AlertsPage() {
  const alerts = await listAlertsForPage();
  const t = await getTranslations();

  return (
    // `overflow-y-auto` is required, not cosmetic: the root layout pins the
    // body to h-screen with overflow-hidden so the map never scrolls the page,
    // which leaves this route unable to scroll at all otherwise (HEAD-19).
    // Same pattern as app/account/page.tsx.
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className={cn("mx-auto w-full max-w-4xl px-4 pt-8 lg:pb-8", TAB_BAR_CLEARANCE)}>
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/map"
            aria-label={t("map.backToHome")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("alerts.title")}</h1>
            {/* Cadence is approximate — GitHub's scheduler drifts under load — so
                the copy says "every few minutes" rather than promising five. */}
            <p className="text-sm text-muted-foreground">{t("alerts.subtitle")}</p>
          </div>
        </div>

        <AlertsList alerts={alerts} />
      </div>
    </div>
  );
}
