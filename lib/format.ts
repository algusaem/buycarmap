import { format, formatDistanceToNow } from "date-fns";
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

/** A minimum and a maximum price, written as one range (MAPUI-1). */
export interface PriceRange {
  min: number;
  max: number;
}

/** The dash between a range's two ends, as the design writes it: «3.000 – 20.000 €». */
const RANGE_DASH = " – ";

// Shared by formatPrice and formatAmount: whole numbers, always with the
// thousands separator — Spanish `Intl` leaves four-digit amounts ungrouped by
// default, and the redesign writes «9.500» as well as «14.500».
const AMOUNT_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  useGrouping: "always",
};

/**
 * The amount boxes' formatter (MAPUI-11): a whole number with the thousands
 * point, no currency sign — the price boxes and «Kilómetros, hasta» read it
 * while not focused (components/map/search/NumberBox.tsx's `grouped`).
 */
export function formatAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, AMOUNT_FORMAT_OPTIONS).format(value);
}

/**
 * The only price formatter (FRONT-11, MAPUI-57): whole euros, always with the
 * thousands separator (`formatAmount`'s own options). A range keeps the
 * locale's own placement of the symbol («3.000 – 20.000 €», «€3,000 –
 * €20,000»); a range whose ends are equal reads as that one price.
 */
export function formatPrice(value: number | PriceRange, locale: string): string {
  const format = new Intl.NumberFormat(locale, {
    ...AMOUNT_FORMAT_OPTIONS,
    style: "currency",
    currency: "EUR",
  });
  if (typeof value === "number") return format.format(value);
  if (value.min === value.max) return format.format(value.min);
  return `${rangeStart(format, value.min)}${RANGE_DASH}${format.format(value.max)}`;
}

/**
 * A range's first end. A locale that writes the symbol after the amount
 * («20.000 €») gives it to the last end only, so the first is the amount
 * alone («3.000»); one that writes it first («€3,000») keeps it on both.
 */
function rangeStart(format: Intl.NumberFormat, amount: number): string {
  const parts = format.formatToParts(amount);
  if (parts.at(-1)?.type !== "currency") return format.format(amount);
  const amountEnd = parts.findLastIndex(
    (part) => part.type !== "currency" && part.type !== "literal",
  );
  return parts
    .slice(0, amountEnd + 1)
    .map((part) => part.value)
    .join("");
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
// reader for the sessions on /account — just enough to show "Chrome on
// Windows" rather than a raw UA string (formatDeviceLabel, below, joins the
// two). Both fields are proper nouns (brand/OS names), so neither goes
// through next-intl — the same reasoning that leaves "Google"/"GitHub"
// untranslated elsewhere. `null` means "could not tell"; the caller falls
// back to a translated "unknown device" string in that case.
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

/** «Creada el …»'s day and month, with the year when it is not the current one, per locale. */
const DATE_PATTERNS = {
  es: { sameYear: "d 'de' MMMM", otherYear: "d 'de' MMMM 'de' yyyy" },
  en: { sameYear: "d MMMM", otherYear: "d MMMM yyyy" },
} as const;

/**
 * docs/specs/redesign-alerts.md (ALERTUI-10; amends FRONT-11): an absolute
 * date, the day and the month in `locale` and in `timeZone` (next-intl's),
 * with the year only when it differs from `now`'s year in that time zone
 * («2 de octubre», «20 de diciembre de 2025»).
 */
export function formatDate(value: Date, locale: string, timeZone: string, now: Date): string {
  const date = new TZDate(value, timeZone);
  const patterns = locale === "es" ? DATE_PATTERNS.es : DATE_PATTERNS.en;
  const sameYear = date.getFullYear() === new TZDate(now, timeZone).getFullYear();
  return format(date, sameYear ? patterns.sameYear : patterns.otherYear, {
    locale: dateFnsLocale(locale),
  });
}

/** «en BuyCarMap desde …»'s month, with the year when it is not the current one, per locale. */
const MONTH_PATTERNS = {
  es: { sameYear: "MMMM", otherYear: "MMMM 'de' yyyy" },
  en: { sameYear: "MMMM", otherYear: "MMMM yyyy" },
} as const;

/**
 * docs/specs/redesign-pages.md (PAGES-31, worked example "Summary line"): the
 * month `value` falls in, in `locale` and in `timeZone` (next-intl's), with
 * the year only when it differs from `now`'s year in that time zone
 * («marzo», «marzo de 2025»), beside formatDate.
 */
export function formatMonth(value: Date, locale: string, timeZone: string, now: Date): string {
  const date = new TZDate(value, timeZone);
  const patterns = locale === "es" ? MONTH_PATTERNS.es : MONTH_PATTERNS.en;
  const sameYear = date.getFullYear() === new TZDate(now, timeZone).getFullYear();
  return format(date, sameYear ? patterns.sameYear : patterns.otherYear, {
    locale: dateFnsLocale(locale),
  });
}

/** Both halves of a device, known. */
interface KnownDevice {
  browser: string;
  os: string;
}

/**
 * docs/specs/redesign-pages.md (PAGES-52, worked example "Device"): a
 * session's device — `join`'s «<navegador> en <sistema>» (the caller's
 * translated `account.sessions.device`) when parseDeviceLabel knows both, the
 * one it knows alone otherwise, and `unknown` (the caller's translated
 * «Dispositivo desconocido») when it knows neither.
 */
export function formatDeviceLabel(
  userAgent: string,
  join: (device: KnownDevice) => string,
  unknown: string,
): string {
  const { browser, os } = parseDeviceLabel(userAgent);
  if (browser && os) return join({ browser, os });
  return browser ?? os ?? unknown;
}
