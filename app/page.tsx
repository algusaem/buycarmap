import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Landing } from "@/components/landing/Landing";

// docs/specs/redesign-entry.md (ENTRY-20). "Buy Car Map" is the brand name,
// not translated copy — identical in both locales' `meta.title` — but reads
// through `t("meta.title")` same as app/login/page.tsx's `generateMetadata`,
// rather than a hand-typed string, so the two pages' titles cannot drift
// from the one message key that names the brand.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("meta.title") };
}

export default function Home() {
  // The footer sits outside <main>: a footer scoped to main is not the page's
  // contentinfo landmark. Both scroll together, so the footer follows the
  // content (docs/specs/redesign-entry.md, ENTRY-24, ENTRY-26, ENTRY-29): from
  // 1440px wide main fills the screen and the footer sits at the bottom; from
  // 1024px to 1439px, the column and the footer are centred as one group, and
  // main gives up the illustration's slot first when the screen is short
  // (Landing.tsx), so the illustration never makes the page scroll. This box
  // is the `landing` size container whose height drops that slot.
  // Signed in at phone width, the tab bar covers its bottom, so the box ends
  // with the clearance the other pages give it (TAB_BAR_CLEARANCE,
  // components/nav/tab-bar-clearance.ts; ENTRY-31, HEAD-19).
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-auto max-lg:with-tab-bar:pb-tab-clearance lg:justify-center-safe lg:@container-size/landing 3xl:justify-start">
      <main className="flex flex-1 flex-col lg:max-3xl:min-h-0 lg:max-3xl:flex-initial lg:max-3xl:landing-illus-hidden:min-h-auto">
        <Landing />
      </main>
      <Footer centered />
    </div>
  );
}
