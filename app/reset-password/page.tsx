import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccessShell } from "@/components/auth/AccessLayout";
import { ResetLinkExpired, ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("resetPassword.title")} · ${t("meta.title")}` };
}

interface ResetPasswordPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

// docs/specs/redesign-pages.md (PAGES-22 to PAGES-24).
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  // Only presence is checked here (PAGES-14). Whether the token is real,
  // unexpired and unused is decided by the server action on submit —
  // validating it during render would turn this page into an oracle for
  // probing tokens without ever consuming one.
  return (
    <AccessShell>
      {token && <ResetPasswordForm token={token} />}
      {!token && <ResetLinkExpired />}
    </AccessShell>
  );
}
