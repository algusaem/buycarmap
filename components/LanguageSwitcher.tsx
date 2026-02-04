"use client";

import { Fragment } from "react";
import * as motion from "motion/react-client";
import { useTranslation } from "@/lib/i18n/client";
import { LOCALES, Locale } from "@/lib/i18n/config";
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
            onClick={() => setLocale(loc)}
            className={cn(
              "relative cursor-pointer text-sm font-medium outline-none",
              locale === loc ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LOCALE_NAMES[loc]}
            {locale === loc && (
              <motion.div
                layoutId="language-indicator"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
