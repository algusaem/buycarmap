import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { LegalContent } from "@/components/legal/LegalContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("legal.terms.title")} · ${t("meta.title")}` };
}

// docs/specs/redesign-pages.md (PAGES-61, PAGES-69): the footer follows the
// text, inside the page's scrolling box.
export default function TermsPage() {
  return (
    <LegalContent doc="terms">
      <Footer />
    </LegalContent>
  );
}
