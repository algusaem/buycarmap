"use client";

import { useTranslation } from "@/lib/i18n/client";
import { LOCALES, Locale } from "@/lib/i18n/config";
import { Globe } from "lucide-react";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

export function LanguageSwitcher() {
  const { locale, setLocale, isPending } = useTranslation();

  const handleChange = (newLocale: Locale) => {
    if (newLocale !== locale) {
      setLocale(newLocale);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/50 p-1 ">
      <Globe className="ml-2 h-4 w-4 text-muted-foreground" />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          disabled={isPending}
          className={`rounded-md px-2 py-1 text-sm font-medium transition-colors cursor-pointer ${
            locale === loc
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          } ${isPending ? "opacity-50" : ""}`}
        >
          {LOCALE_NAMES[loc]}
        </button>
      ))}
    </div>
  );
}
