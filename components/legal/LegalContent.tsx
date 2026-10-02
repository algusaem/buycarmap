"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { fadeInUp } from "@/lib/animations";
import type { Translations } from "@/lib/i18n/types";

interface LegalContentProps {
  doc: "terms" | "privacy";
}

type LegalDocument = Translations["legal"]["terms"];

export function LegalContent({ doc }: LegalContentProps) {
  const t = useTranslations("legal");
  // `t.raw` rather than `t(...)`: this document's sections are structured
  // data (an array of {heading, body}), not a leaf string.
  const content = t.raw(doc) as LegalDocument;

  return (
    <div className="flex-1 overflow-y-auto">
      <motion.article className="mx-auto max-w-3xl px-4 py-10 sm:py-14" {...fadeInUp}>
        <Link
          href="/"
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToHome")}
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {content.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("lastUpdated")}: {content.updated}
        </p>

        <p className="mt-6 text-base leading-relaxed text-muted-foreground">{content.intro}</p>

        <div className="mt-8 space-y-8">
          {content.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
              <p className="text-base leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </motion.article>
    </div>
  );
}
