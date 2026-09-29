import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/alerts/service", () => ({
  findAlertWithMatches: vi.fn(),
  findAlertSummaries: vi.fn(),
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
import { findAlertSummaries, findAlertWithMatches } from "@/server/alerts/service";
import { getAlertWithMatches, listAlertsForPage } from "./queries";

const ADA = { id: "user-ada", email: "ada@example.com" };

const SUMMARY = {
  id: "alert-1",
  label: "Audi A3 under 20k",
  criteria: { brand: "Audi", maxPrice: 20000 },
  matchCount: 2,
  active: true,
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(findAlertWithMatches).mockReset();
  vi.mocked(findAlertSummaries).mockReset();
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
    expect(findAlertWithMatches).toHaveBeenCalledWith("user-ada", "alert-of-grace");
  });
});

describe("listAlertsForPage", () => {
  it("LAYOUT-11: with no session, redirects to /login?callbackUrl=%2Falerts and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(listAlertsForPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Falerts");
    expect(findAlertSummaries).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session, reads with the session user's id and no other", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAlertSummaries).mockResolvedValue([SUMMARY]);

    const alerts = await listAlertsForPage();

    expect(alerts).toEqual([SUMMARY]);
    expect(findAlertSummaries).toHaveBeenCalledTimes(1);
    expect(findAlertSummaries).toHaveBeenCalledWith("user-ada");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session, a failed read resolves to an empty list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAlertSummaries).mockRejectedValue(new Error("db down"));

    await expect(listAlertsForPage()).resolves.toEqual([]);

    expect(redirect).not.toHaveBeenCalled();
  });
});
