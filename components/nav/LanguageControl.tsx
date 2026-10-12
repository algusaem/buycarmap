"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLocaleSwitcher } from "@/lib/hooks/useLocaleSwitcher";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

// HEAD-10 (docs/specs/redesign-navigation.md), keeping CORE-5 and ALERT-50:
// docs/design/system/components/HeaderNav/README.md › Idioma. A group (a
// fieldset, the native element for role="group") of two
// pressed/unpressed buttons, «ES · EN» in that order, with no accent, fill or
// border; each has a 44×44 hit area, which is also what spaces it from its
// neighbours. The switch itself (cookie, setLocale, refresh) is
// useLocaleSwitcher's.
export function LanguageControl() {
  const t = useTranslations();
  const locale = useLocale();
  const { setLocale, isPending } = useLocaleSwitcher();

  return (
    <fieldset
      aria-label={t("nav.language")}
      className={cn("flex items-center font-sans text-[13px]", isPending && "pointer-events-none")}
    >
      <LocaleButton
        locale="es"
        active={locale === "es"}
        label={t("nav.localeEs")}
        onSelect={setLocale}
      />
      <span aria-hidden="true" className="text-text-muted">
        ·
      </span>
      <LocaleButton
        locale="en"
        active={locale === "en"}
        label={t("nav.localeEn")}
        onSelect={setLocale}
      />
    </fieldset>
  );
}

interface LocaleButtonProps {
  locale: Locale;
  active: boolean;
  label: string;
  onSelect: (locale: Locale) => void;
}

function LocaleButton({ locale, active, label, onSelect }: LocaleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={() => onSelect(locale)}
      className={cn(
        "flex h-11 min-w-11 cursor-pointer items-center justify-center",
        active ? "font-extrabold text-text" : "font-semibold text-text-muted",
      )}
    >
      {locale.toUpperCase()}
    </button>
  );
}
