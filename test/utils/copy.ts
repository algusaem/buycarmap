import { createTranslator } from "next-intl";
import type { LocaleCopy } from "@/lib/i18n/copy";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

// The copy a pure text helper (lib/search/filter-chips.ts,
// lib/search/alert-summary.ts, lib/map/group-pins.ts,
// lib/map/results-heading.ts) is given in a test: the real messages of one
// locale, as a component passes `useTranslations()` and `useLocale()`.

/** Spanish, the default locale, whose copy the spec's worked examples quote. */
export const ES_COPY: LocaleCopy = {
  t: createTranslator({ locale: "es", messages: esMessages }),
  locale: "es",
};

/** English. */
export const EN_COPY: LocaleCopy = {
  t: createTranslator({ locale: "en", messages: enMessages }),
  locale: "en",
};
