import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccessShell } from "@/components/auth/AccessLayout";
import {
  VerifyLinkExpired,
  VerifyRegistrationForm,
} from "@/components/auth/VerifyRegistrationForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("verifyEmail.title")} · ${t("meta.title")}` };
}

interface VerifyEmailPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

// docs/specs/redesign-pages.md (PAGES-13 to PAGES-16).
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  // Only presence is checked here (PAGES-14). Whether the token is real and
  // unexpired is decided by the server action on submit — redeeming during
  // render would let a mail scanner's link prefetch create the account
  // before the recipient ever sees this page.
  return (
    <AccessShell>
      {token && <VerifyRegistrationForm token={token} />}
      {!token && <VerifyLinkExpired />}
    </AccessShell>
  );
}
