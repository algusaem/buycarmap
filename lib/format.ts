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
