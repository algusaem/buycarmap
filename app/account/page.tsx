import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountPage } from "@/components/account/AccountPage";
import { getAccountOverview } from "@/server/account/queries";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("account.title")} · ${t("meta.title")}` };
}

// docs/specs/redesign-pages.md (PAGES-25 to PAGES-60): the signed-in user's
// account, read on the server in one query (PAGES-60) — which also sends a
// signed-out visitor to /login before any read — its sessions already marked
// with the one behind this request (PAGES-35). The page's `main`, as its
// loading and error states'.
export default async function AccountRoute() {
  const overview = await getAccountOverview();

  return (
    <main {...MAIN_CONTENT} className="outline-none flex min-h-0 flex-1 flex-col bg-background">
      <AccountPage {...overview} />
    </main>
  );
}
