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
              // `w-11 shrink-0` rather than `min-w-11`: the locale label is
              // always two characters, so a fixed floor is exact rather than
              // content-derived, and `shrink-0` keeps it fixed if this row is
              // ever squeezed by a future neighbour. Measured with the phone
              // menu's slide-in animation in flight, `min-w-11` still resolved
              // to 43.99998px for "EN" on one frame in ten — a transform-timing
              // artifact of the panel's own entrance animation, not a shortfall
              // this class alone removes, but the fixed width is the more
              // correct box for content that never varies.
              "relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-sm font-medium",
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
