import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccessShell } from "@/components/auth/AccessLayout";
import { ConfirmEmailForm, ConfirmLinkExpired } from "@/components/auth/ConfirmEmailForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("confirmEmail.title")} · ${t("meta.title")}` };
}

interface ConfirmEmailPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

// docs/specs/redesign-pages.md (PAGES-17 to PAGES-19).
export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const { token } = await searchParams;

  // Presence only (PAGES-14). Validity is decided by the action on submit,
  // so that a link prefetch cannot burn the token.
  return (
    <AccessShell>
      {token && <ConfirmEmailForm token={token} />}
      {!token && <ConfirmLinkExpired />}
    </AccessShell>
  );
}
