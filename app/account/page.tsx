import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n/server";
import { ProfileForm } from "@/components/account/ProfileForm";
import { EmailForm } from "@/components/account/EmailForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts";
import { SessionsCard } from "@/components/account/SessionsCard";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t.account.title} · ${t.meta.title}` };
}

export default async function AccountPage() {
  // Middleware already redirects unauthenticated visitors, but this is the
  // check that actually matters: middleware only decodes the JWT, while
  // `getCurrentUser` runs the session callback and honours revocation.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  const t = await getTranslations();

  // `password` is null for OAuth-only accounts, which changes which forms
  // apply. Only the presence flag crosses to the client, never the hash.
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      password: true,
      name: true,
      email: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!record) {
    redirect("/login");
  }

  const providers = record.accounts.map((account) => account.provider);

  return (
    // `overflow-y-auto` is required, not cosmetic: the root layout pins the
    // body to h-screen with overflow-hidden so the map never scrolls the page,
    // which leaves every long route unable to scroll at all. Same pattern as
    // components/legal/LegalContent.tsx.
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <Link
          href="/map"
          className="-ml-1 mb-6 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          {t.account.backToMap}
        </Link>

        <header className="mb-8 space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t.account.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.account.description}
          </p>
        </header>

        <div className="space-y-6">
          <ProfileForm name={record.name ?? ""} />

          <EmailForm
            email={record.email}
            isVerified={Boolean(record.emailVerified)}
            // OAuth-only accounts have no password to prove identity with, and
            // their address belongs to the provider.
            canChange={Boolean(record.password)}
          />

          {/* Hidden rather than disabled for OAuth-only accounts: there is no
              current password to enter, so the form has nothing to act on. */}
          {record.password && <ChangePasswordForm email={record.email} />}

          <ConnectedAccounts
            providers={providers}
            hasPassword={Boolean(record.password)}
          />

          <SessionsCard />

          <DeleteAccountForm hasPassword={Boolean(record.password)} />
        </div>
      </div>
    </div>
  );
}
