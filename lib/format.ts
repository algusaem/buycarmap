import { formatDistanceToNow } from "date-fns";
import { es, enGB } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

// FRONT-11 (docs/specs/core-frontend.md): the only formatters components may
// use — no `toLocaleString`, `toFixed`, `new Intl.` or a date-fns `format`
// import inline in `components/` or `app/` (enforced by
// `scripts/core-frontend.node.test.ts`). Numbers go through `Intl.NumberFormat`
// (there is no date-fns equivalent); dates and relative time go through
// date-fns with the matching locale. The time zone is always passed in by the
// caller (ultimately next-intl's request config) — never a literal here or in
// a component.

const DATE_FNS_LOCALES = { es, en: enGB } as const;

function dateFnsLocale(locale: string) {
  return DATE_FNS_LOCALES[locale as keyof typeof DATE_FNS_LOCALES] ?? enGB;
}

export function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatMileage(value: number, locale: string): string {
  // Intl's "km" unit renders as "84 000 km" in some engines without the
  // NBSP the spec's worked example asks for, and locale-dependent unit
  // nouns ("kilómetros" vs "km") are not what the UI wants — so the number
  // is formatted plain and " km" appended with the same NBSP Intl's currency
  // formatting already uses between the number and the symbol.
  return `${new Intl.NumberFormat(locale).format(value)} km`;
}

export function formatRelativeTime(value: Date, locale: string, timeZone = "UTC"): string {
  return formatDistanceToNow(new TZDate(value, timeZone), {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}

export interface DeviceLabel {
  browser: string | null;
  os: string | null;
}

// BAUTH-4 (docs/specs/core-better-auth.md): a tiny, dependency-free `User-Agent`
// reader for the "Active sessions" list on /account — just enough to show
// "Chrome on Windows" rather than a raw UA string. Both fields are proper
// nouns (brand/OS names), so neither goes through next-intl — the same
// reasoning that leaves "Google"/"GitHub" untranslated elsewhere. `null`
// means "could not tell"; the caller falls back to a translated
// "unknown device" string in that case.
export function parseDeviceLabel(userAgent: string): DeviceLabel {
  if (!userAgent) return { browser: null, os: null };

  // iOS devices carry "like Mac OS X" in their own UA string, so that check
  // has to run before the macOS one or every iPhone/iPad reads as a Mac.
  let os: string | null = null;
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/mac os x/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let browser: string | null = null;
  // Order matters: Edge and most mobile browsers also carry "Chrome"/"Safari"
  // tokens in their own UA string, so the more specific match has to run first.
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/chrome\//i.test(userAgent) || /chromium\//i.test(userAgent)) browser = "Chrome";
  else if (/safari\//i.test(userAgent)) browser = "Safari";

  return { browser, os };
}
