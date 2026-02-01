"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { useTranslation } from "@/lib/i18n/client";
import { fadeIn } from "@/lib/animations";

export function LegalNotice() {
  const { t } = useTranslation();

  return (
    <motion.p
      className="text-center text-xs text-muted-foreground/60"
      {...fadeIn(0.3)}
    >
      {t.auth.legalNotice}{" "}
      <Link
        href="/terms"
        className="underline hover:text-muted-foreground"
      >
        {t.auth.terms}
      </Link>{" "}
      {t.auth.and}{" "}
      <Link
        href="/privacy"
        className="underline hover:text-muted-foreground"
      >
        {t.auth.privacyPolicy}
      </Link>
    </motion.p>
  );
}
