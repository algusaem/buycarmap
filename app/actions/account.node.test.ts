import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    session: { deleteMany: vi.fn() },
    account: { delete: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  changePassword,
  deleteAccount,
  signOutEverywhere,
  unlinkAccount,
  updateProfile,
} from "./account";

const NEW_PASSWORD = "harbour-lentil-quilt";
const SESSION_USER = { id: "user-1", email: "ada@example.com" };

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function changeRequest(overrides: Record<string, string> = {}): FormData {
  return formData({
    currentPassword: "the-old-password",
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.user.delete).mockReset();
  vi.mocked(prisma.$transaction).mockClear();
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
});

describe("updateProfile authorization", () => {
  it("refuses when there is no session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await updateProfile(formData({ name: "Ada" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("scopes the update to the session's own user id", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);

    // The form carries no user identifier, so there is nothing a caller could
    // tamper with to edit somebody else's profile.
    await updateProfile(formData({ name: "Ada", id: "someone-else" }));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Ada" },
    });
  });

  it("stores null for a cleared name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);

    await updateProfile(formData({ name: "" }));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: null },
    });
  });

  it("rejects a name past the length limit", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);

    expect(await updateProfile(formData({ name: "a".repeat(81) }))).toEqual({
      success: false,
      error: "nameTooLong",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "old-hash",
      email: "ada@example.com",
    } as never);
  });

  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("rejects an incorrect current password", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires the current password even with a valid session", async () => {
    // This is what stops a stolen session, or someone at an unlocked laptop,
    // from silently taking the account over for good.
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await changePassword(changeRequest());

    expect(verifyPassword).toHaveBeenCalledWith("the-old-password", "old-hash");
  });

  it("rejects setting the same password again", async () => {
    // First call verifies the current password, second is the reuse check.
    vi.mocked(verifyPassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "passwordReused",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a weak new password", async () => {
    vi.mocked(verifyPassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const weak = "qwertyuiopasdfgh";

    expect(
      await changePassword(
        changeRequest({ password: weak, confirmPassword: weak }),
      ),
    ).toEqual({ success: false, error: "passwordWeak" });
  });

  it("refuses for an OAuth-only account with no password set", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: null,
      email: "oauth@example.com",
    } as never);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("bumps passwordChangedAt and clears sessions on success", async () => {
    vi.mocked(verifyPassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    expect(await changePassword(changeRequest())).toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        password: `hashed:${NEW_PASSWORD}`,
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("refuses once the per-account rate limit is spent", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("signOutEverywhere", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await signOutEverywhere()).toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("bumps the revocation clock and clears adapter sessions", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);

    expect(await signOutEverywhere()).toEqual({ success: true });

    // `passwordChangedAt` is the "sessions valid from" marker: every JWT
    // stamped before it is rejected at the next revalidation.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordChangedAt: expect.any(Date) },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("leaves the password untouched", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);

    await signOutEverywhere();

    const update = vi.mocked(prisma.user.update).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // Signing out everywhere must not require or alter the credential.
    expect(update.data).not.toHaveProperty("password");
  });
});

describe("unlinkAccount", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);
    vi.mocked(prisma.account.delete).mockReset();
  });

  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("disconnects a provider when a password remains", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "hash",
      accounts: [{ id: "acc-1", provider: "google" }],
    } as never);

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: true,
    });
    expect(prisma.account.delete).toHaveBeenCalledWith({
      where: { id: "acc-1" },
    });
  });

  it("disconnects one provider when another remains", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: null,
      accounts: [
        { id: "acc-1", provider: "google" },
        { id: "acc-2", provider: "github" },
      ],
    } as never);

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: true,
    });
  });

  it("refuses to remove the only way into a passwordless account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: null,
      accounts: [{ id: "acc-1", provider: "google" }],
    } as never);

    // There would be no password to fall back on, and password reset skips
    // passwordless accounts — the user would be permanently locked out.
    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "lastSignInMethod",
    });
    expect(prisma.account.delete).not.toHaveBeenCalled();
  });

  it("is idempotent for a provider that is not linked", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "hash",
      accounts: [],
    } as never);

    expect(await unlinkAccount(formData({ provider: "github" }))).toEqual({
      success: true,
    });
    expect(prisma.account.delete).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);
  });

  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await deleteAccount(formData({ password: "x" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("requires a password for a credential account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "old-hash",
    } as never);

    expect(await deleteAccount(formData({ password: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("rejects a wrong password without deleting anything", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "old-hash",
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await deleteAccount(formData({ password: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    // Deletion is irreversible and cascades, so this must never be best-effort.
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("deletes the account when the password checks out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "old-hash",
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({
      success: true,
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });

  it("skips the password check for an OAuth-only account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: null,
    } as never);

    expect(await deleteAccount(formData({ password: "" }))).toEqual({
      success: true,
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});
