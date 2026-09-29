import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { listAlerts } from "@/server/alerts/actions";
import { AlertsList } from "@/components/alerts/AlertsList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t.alerts.title} · ${t.meta.title}` };
}

export default async function AlertsPage() {
  // `proxy.ts` already redirects anonymous visitors, but this is the check that
  // matters: the proxy only decodes the JWT, while `getCurrentUser` runs the
  // session callback and honours revocation.
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Falerts");

  const t = await getTranslations();
  const result = await listAlerts();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/map"
          aria-label={t.map.backToHome}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.alerts.title}</h1>
          {/* Cadence is approximate — GitHub's scheduler drifts under load — so
              the copy says "every few minutes" rather than promising five. */}
          <p className="text-sm text-muted-foreground">{t.alerts.subtitle}</p>
        </div>
      </div>

      <AlertsList alerts={result.data ?? []} />
    </div>
  );
}
