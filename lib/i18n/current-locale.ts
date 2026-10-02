import { getLocale as getNextIntlLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "@/lib/i18n/config";

// Server code that needs the request's locale as the narrow `Locale` union
// (to pass to `lib/email/templates/*` and similar) rather than next-intl's
// own `Promise<string>|string` return type. Falls back to the default rather
// than asserting, in case `i18n/request.ts`'s `getRequestConfig` ever resolves
// to something resolveLocale itself would never produce.
export async function getCurrentLocale(): Promise<Locale> {
  const locale = await getNextIntlLocale();
  return isValidLocale(locale) ? locale : DEFAULT_LOCALE;
}
