import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getCurrentUserWithSessionId: vi.fn() }));
// The real toListedSession: only the read is faked.
vi.mock("@/server/account/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/account/service")>()),
  findAccountOverview: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { redirect } from "next/navigation";
import { getCurrentUserWithSessionId } from "@/lib/auth/session";
import { asSessionId } from "@/lib/ids";
import { findAccountOverview } from "@/server/account/service";
import { getAccountOverview } from "./queries";

const ADA = { id: "user-ada", email: "ada@example.com" };
const ADA_SIGNED_IN = { user: ADA, sessionId: asSessionId("session-ada-laptop") };

// The record's shape since docs/specs/redesign-pages.md (PAGES-60): whether
// there is a password rather than its hash, the providers, the counts, the
// creation date and the sessions.
const RECORD = {
  hasPassword: true,
  name: "Ada",
  email: "ada@example.com",
  emailConfirmed: false,
  twoFactorEnabled: false,
  version: 1,
  createdAt: new Date("2026-03-10T10:00:00.000Z"),
  providers: [],
  favoritesCount: 0,
  alertsCount: 0,
  sessions: [],
};

beforeEach(() => {
  vi.mocked(getCurrentUserWithSessionId).mockReset();
  vi.mocked(findAccountOverview).mockReset();
  vi.mocked(redirect).mockClear();
});

describe("getAccountOverview", () => {
  it("LAYOUT-11: with no session, redirects to /login?callbackUrl=/account and reads nothing", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue(null);

    await expect(getAccountOverview()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=/account");
    expect(findAccountOverview).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session but no record, redirects to /login", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue(ADA_SIGNED_IN);
    vi.mocked(findAccountOverview).mockResolvedValue(null);

    await expect(getAccountOverview()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("LAYOUT-11: with a session, reads with the session user's id and no other", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue(ADA_SIGNED_IN);
    vi.mocked(findAccountOverview).mockResolvedValue(RECORD);

    const record = await getAccountOverview();

    expect(record).toEqual(RECORD);
    expect(findAccountOverview).toHaveBeenCalledTimes(1);
    expect(findAccountOverview).toHaveBeenCalledWith("user-ada");
    expect(redirect).not.toHaveBeenCalled();
  });
});

// docs/specs/redesign-pages.md (PAGES-35): the session behind this request is
// marked among the user's own from the same lookup that found the user.
describe("PAGES-35: getAccountOverview marks the current session", () => {
  const SESSIONS = [
    {
      id: "session-ada-phone",
      userAgent: "Safari/604 iPhone",
      updatedAt: new Date("2026-10-16T12:00:00.000Z"),
    },
    {
      id: "session-ada-laptop",
      userAgent: "Chrome/120 Windows",
      updatedAt: new Date("2026-10-14T12:00:00.000Z"),
    },
  ];

  it("PAGES-35: the session whose id is the request's reads current, the other does not", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue(ADA_SIGNED_IN);
    vi.mocked(findAccountOverview).mockResolvedValue({ ...RECORD, sessions: SESSIONS });

    const record = await getAccountOverview();

    expect(record.sessions.map(({ id, current }) => [id, current])).toEqual([
      ["session-ada-phone", false],
      ["session-ada-laptop", true],
    ]);
    expect(getCurrentUserWithSessionId).toHaveBeenCalledTimes(1);
  });

  it("PAGES-35: with the request's session not among them, none reads current", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue({
      user: ADA,
      sessionId: asSessionId("session-elsewhere"),
    });
    vi.mocked(findAccountOverview).mockResolvedValue({ ...RECORD, sessions: SESSIONS });

    const record = await getAccountOverview();

    expect(record.sessions.map(({ current }) => current)).toEqual([false, false]);
  });
});
