import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/account/service", () => ({ findAccountOverview: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { findAccountOverview } from "@/server/account/service";
import { getAccountOverview } from "./queries";

const ADA = { id: "user-ada", email: "ada@example.com" };

const RECORD = {
  password: "hashed",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: null,
  twoFactorEnabledAt: null,
  accounts: [],
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(findAccountOverview).mockReset();
  vi.mocked(redirect).mockClear();
});

describe("getAccountOverview", () => {
  it("LAYOUT-11: with no session, redirects to /login?callbackUrl=/account and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(getAccountOverview()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=/account");
    expect(findAccountOverview).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session but no record, redirects to /login", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAccountOverview).mockResolvedValue(null);

    await expect(getAccountOverview()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("LAYOUT-11: with a session, reads with the session user's id and no other", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findAccountOverview).mockResolvedValue(RECORD);

    const record = await getAccountOverview();

    expect(record).toEqual(RECORD);
    expect(findAccountOverview).toHaveBeenCalledTimes(1);
    expect(findAccountOverview).toHaveBeenCalledWith("user-ada");
    expect(redirect).not.toHaveBeenCalled();
  });
});
