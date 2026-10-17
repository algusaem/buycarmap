import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccessShell } from "@/components/auth/AccessLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("forgotPassword.title")} · ${t("meta.title")}` };
}

// docs/specs/redesign-pages.md (PAGES-20, PAGES-21; Contracts › Server): a
// Server Component, with the form as the client part (RULES.md §9).
export default function ForgotPasswordPage() {
  return (
    <AccessShell>
      <ForgotPasswordForm />
    </AccessShell>
  );
}
