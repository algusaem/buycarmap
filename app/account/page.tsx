import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/account/ProfileForm";
import { EmailForm } from "@/components/account/EmailForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts";
import { SessionsCard } from "@/components/account/SessionsCard";
import { DataExportCard } from "@/components/account/DataExportCard";
import { TwoFactorCard } from "@/components/account/TwoFactorCard";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { TAB_BAR_CLEARANCE } from "@/components/nav/tab-bar-clearance";
import { cn } from "@/lib/utils";
import { getAccountOverview } from "@/server/account/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("account.title")} · ${t("meta.title")}` };
}

export default async function AccountPage() {
  // Authenticates (and redirects a signed-out visitor) before any read.
  const record = await getAccountOverview();
  const t = await getTranslations();

  // BAUTH-14's "credential" accounts row is Better Auth's own sign-in
  // plumbing, never a provider the user connected — it must never reach the
  // "connected accounts" list (security review BLOCKER). findAccountOverview
  // already excludes it; filtered again here so this list stays correct even
  // if that query's own shape ever changes.
  const providers = record.accounts
    .map((account) => account.provider)
    .filter((provider) => provider !== "credential");

  return (
    // `overflow-y-auto` is required, not cosmetic: the root layout pins the
    // body to h-screen with overflow-hidden so the map never scrolls the page,
    // which leaves every long route unable to scroll at all. Same pattern as
    // components/legal/LegalContent.tsx.
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div
        className={cn("mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-12 lg:pb-12", TAB_BAR_CLEARANCE)}
      >
        <Link
          href="/map"
          className="-ml-1 mb-6 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("account.backToMap")}
        </Link>

        {/* HEAD-13: «Cerrar sesión» is one control drawn in two places
            (AccountCard README): beside the title from lg, at the end of the
            content below it. CSS shows exactly one per width, and the other is
            display:none, so it is out of the accessibility tree as well. */}
        <header className="mb-8 flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{t("account.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("account.description")}</p>
          </div>
          <SignOutButton className="hidden lg:inline-flex" />
        </header>

        <div className="space-y-6">
          <ProfileForm name={record.name ?? ""} version={record.version} />

          <EmailForm
            email={record.email}
            isVerified={record.emailConfirmed}
            // OAuth-only accounts have no password to prove identity with, and
            // their address belongs to the provider.
            canChange={Boolean(record.password)}
          />

          {/* Hidden rather than disabled for OAuth-only accounts: there is no
              current password to enter, so the form has nothing to act on. */}
          {record.password && <ChangePasswordForm email={record.email} version={record.version} />}

          {/* Only offered to credential accounts: an OAuth-only user signs in
              through their provider, which owns its own second factor. */}
          {record.password && <TwoFactorCard isEnabled={record.twoFactorEnabled} />}

          <ConnectedAccounts providers={providers} hasPassword={Boolean(record.password)} />

          <SessionsCard />

          <DataExportCard />

          <DeleteAccountForm hasPassword={Boolean(record.password)} />
        </div>

        <SignOutButton className="mt-6 w-full lg:hidden" />
      </div>
    </div>
  );
}
