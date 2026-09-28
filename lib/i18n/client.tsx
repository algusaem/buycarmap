"use client";

import { createContext, useContext, useCallback, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type Locale, COOKIE_NAME, DEFAULT_LOCALE } from "./config";
import { translations, type Translations } from "./translations";

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale: Locale;
}

export function I18nProvider({ children, locale }: I18nProviderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      // biome-ignore lint/suspicious/noDocumentCookie: the hand-rolled i18n layer keeps the locale in a client cookie until phase 9 replaces it with next-intl (ADR 0007 row 20)
      document.cookie = `${COOKIE_NAME}=${newLocale};path=/;max-age=31536000`;
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  const value: I18nContextValue = {
    locale,
    t: translations[locale],
    setLocale,
    isPending,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      t: translations[DEFAULT_LOCALE],
      setLocale: () => {
        /* no provider mounted: there is no locale state to change */
      },
      isPending: false,
    };
  }

  return context;
}
