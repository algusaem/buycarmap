import { useLocale, useNow, useTimeZone, useTranslations } from "next-intl";
import { formatDeviceLabel, formatMonth, formatRelativeTime } from "@/lib/format";
import type { ListedSession } from "@/server/account/actions";

// docs/specs/redesign-pages.md (PAGES-31, PAGES-35, PAGES-49, PAGES-52): the
// texts /account's cards and its «Sesiones» dialog write, in the page's
// locale and next-intl's time zone (FRONT-11). The month, the device and «hace
// 2 días» are lib/format.ts's.

/** How many sessions the «Sesiones» card's line names before «y N más» (PAGES-35). */
const NAMED_SESSIONS = 2;

export function useAccountLabels() {
  const t = useTranslations();
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  const now = useNow();

  /** «Chrome en Windows», «Firefox», or «Dispositivo desconocido» (PAGES-52). */
  const device = (userAgent: string) =>
    formatDeviceLabel(
      userAgent,
      (parts) => t("account.sessions.device", { ...parts }),
      t("account.sessions.unknownDevice"),
    );

  /** When a session was last used: «hace 2 días». */
  const lastUsed = (date: Date) => formatRelativeTime(date, locale, timeZone);

  const sessionEntry = (session: ListedSession) =>
    session.current
      ? t("account.sessions.thisDevice", { device: device(session.userAgent) })
      : t("account.sessions.otherDevice", {
          device: device(session.userAgent),
          when: lastUsed(session.lastUsedAt),
        });

  return {
    device,
    lastUsed,
    /**
     * The values of the own card's line, `account.summary.line`: «8 guardados ·
     * 3 alertas · en BuyCarMap desde marzo» (PAGES-31), one message so a
     * translation can reorder it.
     */
    summary: (favoritesCount: number, alertsCount: number, createdAt: Date) => ({
      saved: favoritesCount,
      alerts: alertsCount,
      month: formatMonth(createdAt, locale, timeZone, now),
    }),
    /**
     * The «Sesiones» card's line (PAGES-35, worked example "Sessions line"):
     * the two most recently used sessions, newest first, this device's as
     * «<device>, esta.», then «y N más» for the rest. `sessions` comes
     * newest-used first (PAGES-60).
     */
    sessionsLine: (sessions: ListedSession[]) => {
      const [first, second] = sessions.slice(0, NAMED_SESSIONS).map(sessionEntry);
      return t("account.sessions.line", {
        first: first ?? "",
        second: second ?? "none",
        more: Math.max(sessions.length - NAMED_SESSIONS, 0),
      });
    },
  };
}
