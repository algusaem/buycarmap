import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageStateLayout } from "@/components/ui/PageStateLayout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("notFound.punchline")} · ${t("meta.title")}` };
}

// docs/specs/redesign-pages.md (PAGES-65, PAGES-66, PAGES-69); F7-no-existe.
// Every address no route matches, and every notFound(): the page-error body
// (PAGES-57) with its own headline, «¿Te has perdido? / Esto no existe» as the
// page's `h1`, and one action, primary because it is the only one. The header
// and the tab bar are the root layout's, picked by the session for an unknown
// address (components/nav/nav-routes.ts).
export default function NotFound() {
  const t = useTranslations();

  return (
    <PageStateLayout sides="session">
      <EmptyState
        headingLevel="h1"
        question={t("notFound.question")}
        punchline={t("notFound.punchline")}
        line={t("notFound.line")}
      >
        <Button asChild variant="primary" size="48">
          <Link href="/map">{t("nav.backToMap")}</Link>
        </Button>
      </EmptyState>
    </PageStateLayout>
  );
}
