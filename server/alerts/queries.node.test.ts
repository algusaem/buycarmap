import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/alerts/service", () => ({
  findAlertWithMatches: vi.fn(),
  findAlertsPage: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { asAlertId, asUserId } from "@/lib/ids";
import { findAlertsPage, findAlertWithMatches } from "@/server/alerts/service";
import { ALERT_ID, adaAlerts, corollaMatches } from "@/test/fixtures/alert-listings";
import { getAlertWithMatches, listAlertsForPage } from "./queries";

const ADA = { id: "user-ada", email: "ada@example.com" };

const SUMMARY = {
  id: asAlertId("alert-1"),
  label: "Audi A3 under 20k",
  criteria: { brand: "Audi", maxPrice: 20000 },
  matchCount: 2,
  active: true,
  placeName: null,
  createdAt: new Date("2026-10-02T10:00:00.000Z"),
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(findAlertWithMatches).mockReset();
  vi.mocked(findAlertsPage).mockReset();
  vi.mocked(redirect).mockClear();
  vi.mocked(notFound).mockClear();
});

describe("getAlertWithMatches", () => {
  it("LAYOUT-11: with no session, redirects to log in and back to the alert, and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(getAlertWithMatches("alert-1")).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Falerts%2Falert-1");
    expect(findAlertWithMatches).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: another user's alert is notFound(), because the read scoped by userId returns null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAlertWithMatches).mockResolvedValue(null);

    await expect(getAlertWithMatches("alert-of-grace")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(findAlertWithMatches).toHaveBeenCalledTimes(1);
    expect(findAlertWithMatches).toHaveBeenCalledWith(
      asUserId("user-ada"),
      asAlertId("alert-of-grace"),
    );
  });
});

describe("listAlertsForPage", () => {
  it("LAYOUT-11: with no session, redirects to /login?callbackUrl=%2Falerts and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(listAlertsForPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Falerts");
    expect(findAlertsPage).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session, reads with the session user's id and no other", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAlertsPage).mockResolvedValue({
      alerts: [SUMMARY],
      openAlertId: asAlertId("alert-1"),
      matches: [],
    });

    const { alerts } = await listAlertsForPage();

    expect(alerts).toEqual([SUMMARY]);
    expect(findAlertsPage).toHaveBeenCalledTimes(1);
    expect(findAlertsPage).toHaveBeenCalledWith(asUserId("user-ada"), undefined);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("PLAT-14: with a session, a failed read rejects instead of resolving to an empty list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAlertsPage).mockRejectedValue(new Error("db down"));

    await expect(listAlertsForPage()).rejects.toThrow("db down");

    expect(redirect).not.toHaveBeenCalled();
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-44, ALERTUI-45; worked example "Page
// queries"): the /alerts page query authenticates, then hands the URL's
// `alert` to the service's one page read (server/alerts/service.ts's
// findAlertsPage, which resolves it among the caller's own alerts: ALERTUI-12
// in schema.test.ts, end to end in queries.integration.test.ts), for the
// session user only.
describe("ALERTUI-44: the /alerts page query", () => {
  const ADAS = adaAlerts();

  it("ALERTUI-44: signed out, it redirects to /login?callbackUrl=%2Falerts and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(listAlertsForPage(ALERT_ID.golf)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Falerts");
    expect(findAlertsPage).not.toHaveBeenCalled();
  });

  it.each([
    ["no `alert`", null],
    ["Serie 3's id", ALERT_ID.serie3],
    ["Grace's id", ALERT_ID.grace],
    ["a malformed id", "not-a-uuid"],
    ["an empty id", ""],
  ])(
    "ALERTUI-44: with %s, it reads the page once, for Ada and that `alert`, and returns what it read",
    async (_case, requested) => {
      vi.mocked(getCurrentUser).mockResolvedValue(ADA);
      const read = {
        alerts: ADAS,
        openAlertId: ALERT_ID.corolla,
        matches: corollaMatches(),
      };
      vi.mocked(findAlertsPage).mockResolvedValue(read);

      const page = await listAlertsForPage(requested);

      expect(page).toBe(read);
      expect(findAlertsPage).toHaveBeenCalledTimes(1);
      expect(findAlertsPage).toHaveBeenCalledWith(asUserId("user-ada"), requested);
    },
  );
});

describe("ALERTUI-45: the /alerts/[id] page query", () => {
  it("ALERTUI-45: signed out, it redirects to /login?callbackUrl=%2Falerts%2F<id> and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(getAlertWithMatches(ALERT_ID.corolla)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith(`/login?callbackUrl=%2Falerts%2F${ALERT_ID.corolla}`);
    expect(findAlertWithMatches).not.toHaveBeenCalled();
  });
});
