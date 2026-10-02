import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isValidLocale, DEFAULT_LOCALE, COOKIE_NAME, type Locale } from "@/lib/i18n/config";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const MESSAGES = { en: enMessages, es: esMessages } satisfies Record<Locale, unknown>;

// FRONT-9 (docs/specs/core-frontend.md): the `locale` cookie decides first;
// absent, `Accept-Language` limited to es/en falls back; unknown values fall
// through, and the ultimate default is `es` (`lib/i18n/config.ts`'s
// `DEFAULT_LOCALE`). Kept pure and dependency-free so it can be unit-tested
// with no request in scope — `getRequestConfig` below is the only caller that
// needs a real request.
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (cookieValue && isValidLocale(cookieValue)) return cookieValue;

  if (acceptLanguage) {
    const wantsEnglish = acceptLanguage
      .split(",")
      .some((entry) => entry.trim().toLowerCase().startsWith("en"));
    if (wantsEnglish) return "en";
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get(COOKIE_NAME)?.value,
    headerList.get("accept-language"),
  );

  // Set by lib/geo/TimeZoneCookie.tsx (a tiny client component in the root
  // layout) from `Intl.DateTimeFormat().resolvedOptions().timeZone`, once per
  // browser. Absent on the very first request before that cookie lands, and
  // never literal in a component (FRONT-11) — UTC until then.
  const timeZone = cookieStore.get("tz")?.value || "UTC";

  return { locale, messages: MESSAGES[locale], timeZone };
});
