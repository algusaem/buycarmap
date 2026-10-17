import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import { ALERT_ID, adaAlerts, golfMatches } from "@/test/fixtures/alert-listings";
import type { AlertsPageData } from "@/interfaces/alert";

// docs/specs/redesign-alerts.md (ALERTUI-1, ALERTUI-12): the
// /alerts route's own frame. `getTranslations` only resolves under the
// "react-server" condition, absent here, so it is stubbed with the real
// Spanish messages (test/utils/copy.ts), as app/favorites/page.test.tsx does.
// The page query is server/alerts/queries*.test.ts's; the page's composition
// components/alerts/AlertsPage*.test.tsx's.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/alerts/queries", () => ({
  listAlertsForPage: vi.fn(
    async (): Promise<AlertsPageData> => ({
      alerts: adaAlerts(),
      openAlertId: ALERT_ID.golf,
      matches: golfMatches(),
    }),
  ),
}));
vi.mock("@/components/alerts/AlertsPage", () => ({
  AlertsPage: ({ alerts, openAlertId, matches }: AlertsPageData) => (
    <div
      data-testid="alerts-page"
      data-alerts={alerts.length}
      data-open={openAlertId ?? ""}
      data-matches={matches.length}
    />
  ),
}));

import { listAlertsForPage } from "@/server/alerts/queries";
import AlertsRoute, { generateMetadata } from "./page";

/** The route's props with the URL's `alert`. */
function withAlert(alert?: string | string[]) {
  return { searchParams: Promise.resolve(alert === undefined ? {} : { alert }) };
}

describe("ALERTUI-1: the /alerts route", () => {
  it("ALERTUI-1: the browser title is «Alertas · Buy Car Map»", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Alertas · Buy Car Map");
  });
});

describe("ALERTUI-12: the route reads the open alert from the URL", () => {
  it("ALERTUI-12: /alerts?alert=<Golf's id> asks the page query for Golf and hands the page its answer", async () => {
    renderWithI18n(await AlertsRoute(withAlert(ALERT_ID.golf)), { locale: "es" });

    expect(listAlertsForPage).toHaveBeenLastCalledWith(ALERT_ID.golf);
    const page = screen.getByTestId("alerts-page");
    expect(page).toHaveAttribute("data-alerts", "4");
    expect(page).toHaveAttribute("data-open", ALERT_ID.golf);
    expect(page).toHaveAttribute("data-matches", "1");
  });

  it("ALERTUI-12: /alerts with no `alert` asks for no particular alert", async () => {
    await AlertsRoute(withAlert());

    expect(vi.mocked(listAlertsForPage).mock.lastCall?.[0] ?? null).toBeNull();
  });

  it("ALERTUI-12: a repeated `alert`, ?alert=<Golf's id>&alert=<Clio's id>, asks the page query for Golf", async () => {
    await AlertsRoute(withAlert([ALERT_ID.golf, ALERT_ID.clio]));

    expect(listAlertsForPage).toHaveBeenLastCalledWith("0199a000-0000-7000-8000-00000000c002");
  });

  it("ALERTUI-12: an `alert` with no value, [], asks for null", async () => {
    await AlertsRoute(withAlert([]));

    expect(listAlertsForPage).toHaveBeenLastCalledWith(null);
  });
});
