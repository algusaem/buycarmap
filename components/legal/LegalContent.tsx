"use client";

import type { ReactNode } from "react";
import * as motion from "motion/react-client";
import { useTranslations } from "next-intl";
import { fadeInUp } from "@/lib/animations";
import { useLegalToc } from "@/lib/hooks/useLegalToc";
import type { Translations } from "@/lib/i18n/types";
import { LegalToc } from "./LegalToc";

interface LegalContentProps {
  doc: "terms" | "privacy";
  /** What follows the text inside the page's scrolling box: the footer (PAGES-61). */
  children?: ReactNode;
}

type LegalDocument = Translations["legal"]["terms"];

// docs/specs/redesign-pages.md (PAGES-61 to PAGES-64, PAGES-74; amends
// FRONT-27); F0-legal, F7-legal-estados. The page's scrolling box, so the
// footer follows the text and the index stays put beside it. From `lg`: 48px
// sides, the 260px index, 72px, and a reading column of at most 720px (596px
// at 1024px). On a phone: one column, the index folded after the date. Each
// section's `h2` carries its stable id from the message files, which its
// index link names.
export function LegalContent({ doc, children }: LegalContentProps) {
  const t = useTranslations("legal");
  // `t.raw` rather than `t(...)`: this document's sections are structured
  // data (an array of {id, heading, body}), not a leaf string.
  const content = t.raw(doc) as LegalDocument;
  const toc = useLegalToc(content.sections[0]?.id ?? "");

  return (
    <div
      ref={toc.scrollerRef}
      onScroll={toc.onScroll}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="flex flex-col gap-4 px-5 pt-3.5 pb-10 lg:grid lg:grid-cols-legal lg:gap-x-18 lg:gap-y-5.5 lg:px-12 lg:py-7.5">
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:gap-5.5">
          <h1 className="m-0 font-display text-page-title-mobile font-black uppercase lg:text-legal-h1">
            {content.title}
          </h1>
          <p className="m-0 text-small text-text-muted lg:text-label">
            {t("lastUpdated")}: {content.updated}
          </p>
        </div>

        <LegalToc
          sections={content.sections}
          current={toc.current}
          open={toc.open}
          showList={toc.showList}
          foldWithCss={toc.foldWithCss}
          onToggle={toc.toggle}
          onSelect={toc.select}
          onListExitComplete={toc.onListExitComplete}
        />

        <motion.article
          className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:gap-5.5"
          {...fadeInUp}
        >
          <p className="m-0 text-body text-text-legal max-lg:leading-relaxed lg:text-legal-body">
            {content.intro}
          </p>
          {content.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-4 lg:gap-5.5">
              <h2
                id={section.id}
                className="m-0 mt-1.5 scroll-mt-7.5 font-display text-alert-name font-extrabold uppercase lg:mt-3 lg:text-legal-h2"
              >
                {section.heading}
              </h2>
              <p className="m-0 text-body text-text-legal max-lg:leading-relaxed lg:text-legal-body">
                {section.body}
              </p>
            </section>
          ))}
        </motion.article>
      </div>
      {children}
    </div>
  );
}
