import { cookies, headers } from "next/headers";
import {
  COOKIE_NAME,
  DEFAULT_LOCALE,
  isValidLocale,
  Locale,
  LOCALES,
} from "./config";
import { translations, Translations } from "./translations";

function parseAcceptLanguage(header: string): Locale | null {
  const languages = header
    .split(",")
    .map((lang) => {
      const [code, qValue] = lang.trim().split(";q=");
      return {
        code: code.split("-")[0].toLowerCase(),
        q: qValue ? parseFloat(qValue) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { code } of languages) {
    if (LOCALES.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return null;
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (localeCookie && isValidLocale(localeCookie)) {
    return localeCookie;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");

  if (acceptLanguage) {
    const browserLocale = parseAcceptLanguage(acceptLanguage);
    if (browserLocale) {
      return browserLocale;
    }
  }

  return DEFAULT_LOCALE;
}

export async function getTranslations(): Promise<Translations> {
  const locale = await getLocale();
  return translations[locale];
}

export function getTranslationsSync(locale: Locale): Translations {
  return translations[locale];
}
