import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccessShell } from "@/components/auth/AccessLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isGoogleConfigured } from "@/lib/app-config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("auth.createAccount")} · ${t("meta.title")}` };
}

// docs/specs/redesign-pages.md (PAGES-1, PAGES-7, PAGES-9 to PAGES-12):
// /register on the access composition (components/auth/AccessLayout.tsx).
// The form and its «check your inbox» state are RegisterForm's, which swaps
// them; the page only frames them. No illustration under 1440px: the form is
// taller than /login's, and under ENTRY-29's rule less than 150px of drawing
// fits (the spec's Decisions).
export default function RegisterPage() {
  return (
    <AccessShell>
      <RegisterForm isGoogleConfigured={isGoogleConfigured} />
    </AccessShell>
  );
}
