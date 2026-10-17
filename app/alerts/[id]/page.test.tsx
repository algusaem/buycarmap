import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import { ALERT_ID, alertWithMatches } from "@/test/fixtures/alert-listings";
import type { AlertWithMatches } from "@/interfaces/alert";

// docs/specs/redesign-alerts.md (ALERTUI-20, ALERTUI-45): the /alerts/[id]
// route's own frame — its browser title and what it hands the page. The page
// query returns the alert with its criteria read back and each match as a
// listing (server/alerts/service.ts's findAlertWithMatches, proved against
// Postgres in server/alerts/queries.integration.test.ts); the route hands it
// to AlertPage as it is. `getTranslations` is stubbed with the real Spanish
// messages, as app/favorites/page.test.tsx does.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/0199a000-0000-7000-8000-00000000c001",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));

const READ = vi.hoisted(() => ({ alert: null as AlertWithMatches | null }));
vi.mock("@/server/alerts/queries", () => ({
  getAlertWithMatches: vi.fn(async () => READ.alert),
}));
const received = vi.hoisted(() => ({ alert: null as AlertWithMatches | null }));
vi.mock("@/components/alerts/AlertPage", () => ({
  AlertPage: ({ alert }: { alert: AlertWithMatches }) => {
    received.alert = alert;
    return <div data-testid="alert-page" />;
  },
}));

import { getAlertWithMatches } from "@/server/alerts/queries";
import AlertMatchesPage, { generateMetadata } from "./page";

const PARAMS = { params: Promise.resolve({ id: ALERT_ID.corolla }) };

READ.alert = alertWithMatches("corolla");

describe("ALERTUI-20: the /alerts/[id] route", () => {
  it("ALERTUI-20: the browser title is «Corolla híbrido · Buy Car Map», the alert's name", async () => {
    const metadata = await generateMetadata(PARAMS);

    expect(metadata.title).toBe("Corolla híbrido · Buy Car Map");
    expect(getAlertWithMatches).toHaveBeenCalledWith(ALERT_ID.corolla);
  });

  it("ALERTUI-20: hands the page the alert the query read, as it is", async () => {
    renderWithI18n(await AlertMatchesPage(PARAMS), { locale: "es" });

    expect(screen.getByTestId("alert-page")).toBeInTheDocument();
    expect(received.alert).toBe(READ.alert);
    expect(received.alert).toMatchObject({ id: ALERT_ID.corolla, label: "Corolla híbrido" });
  });
});
