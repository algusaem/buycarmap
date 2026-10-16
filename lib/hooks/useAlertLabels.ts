import { useLocale, useNow, useTimeZone, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import { alertCriteria, alertZone } from "@/lib/search/alert-summary";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-alerts.md (ALERTUI-5, ALERTUI-9, ALERTUI-10,
// ALERTUI-15): the texts every alert card, page and pill writes, in the
// page's locale and next-intl's time zone (FRONT-11). The criteria and the
// zone are lib/search/alert-summary.ts's, the date lib/format.ts's.

/** What an alert's texts are read from: its stored criteria and its place name. */
interface AlertSource {
  criteria: SearchInput;
  placeName: string | null;
}

export function useAlertLabels() {
  const t = useTranslations();
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  const now = useNow();
  const copy = { t, locale };

  return {
    /** The criteria, in the card's order: «Toyota Corolla», «Híbrido», «Hasta 18.000 €», «Madrid · 50 km». */
    criteria: (alert: AlertSource) => alertCriteria(alert.criteria, alert.placeName, copy),
    /** The zone alone, «Madrid · 50 km» or «50 km»; undefined with no place. */
    zone: (alert: AlertSource) => alertZone(alert.criteria, alert.placeName, copy),
    /** «Sin coincidencias», «1 coincidencia», «N coincidencias». */
    matchCount: (count: number) => t("alerts.matchCount", { count }),
    /** «Creada el 2 de octubre», with the year only when it is not the current one. */
    createdOn: (createdAt: Date) =>
      t("alerts.createdOn", { date: formatDate(createdAt, locale, timeZone, now) }),
  };
}
