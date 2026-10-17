import type { MessageKeys, NestedKeyOf } from "next-intl";
import type { Translations } from "./types";

// The namespaces the pure text helpers read (lib/search/filter-chips.ts,
// lib/search/alert-summary.ts, lib/map/group-pins.ts,
// lib/map/results-heading.ts).
type HelperMessages = Pick<Translations, "search" | "filters" | "map" | "mapStates">;

/** Every message key the pure text helpers may ask for, checked against `lib/i18n/types.ts`. */
type HelperMessageKey = MessageKeys<HelperMessages, NestedKeyOf<HelperMessages>>;

/**
 * A translate function, reduced to what the pure text helpers call. A
 * component passes next-intl's `useTranslations()` here.
 */
type HelperTranslate = (key: HelperMessageKey, values?: Record<string, string | number>) => string;

/**
 * What a pure helper needs to write user-facing text: the messages and the
 * locale for numbers. Always the caller's — a component passes
 * `{ t: useTranslations(), locale: useLocale() }` — so the buyer's locale
 * applies and no helper falls back to one of its own.
 */
export interface LocaleCopy {
  t: HelperTranslate;
  locale: string;
}
