"use client";

import { Fragment } from "react";
import * as motion from "motion/react-client";
import { useTranslation } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

export function LanguageSwitcher() {
  const { locale, setLocale, isPending } = useTranslation();

  return (
    <div className={cn("flex items-center gap-2", isPending && "pointer-events-none")}>
      <Globe className="h-4 w-4 text-muted-foreground" />
      {LOCALES.map((loc, index) => (
        <Fragment key={loc}>
          {index > 0 && <span className="text-border">/</span>}
          <button
            type="button"
            onClick={() => setLocale(loc)}
            aria-current={locale === loc ? "true" : undefined}
            className={cn(
              // Was bare text at roughly 20x16 — under half the 44px mobile
              // floor, which is what made mistapping the neighbouring control
              // the normal outcome. The visual size is unchanged; the target
              // around it is not.
              "relative flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium",
              // `outline-none` with no replacement left keyboard users with no
              // focus indicator at all.
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              locale === loc ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_NAMES[loc]}
            {locale === loc && (
              <motion.div
                layoutId="language-indicator"
                className="absolute bottom-2 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
