import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  changePassword,
  deleteAccount,
  signOutEverywhere,
  unlinkAccount,
  updateProfile,
} from "./actions";

const NEW_PASSWORD = "harbour-lentil-quilt";

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

async function signedInAsNewUser(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ password: "old-hash", ...overrides });
  vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });
  return user;
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
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
  });

  it("scopes the update to the session's own user id", async () => {
    const user = await signedInAsNewUser();

    // The form carries no user identifier, so there is nothing a caller could
    // tamper with to edit somebody else's profile.
    await updateProfile(formData({ name: "Ada", id: "someone-else" }));

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBe("Ada");
  });

  it("stores null for a cleared name", async () => {
    const user = await signedInAsNewUser({ name: "Ada" });

    await updateProfile(formData({ name: "" }));

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBeNull();
  });

  it("rejects a name past the length limit", async () => {
    const user = await signedInAsNewUser({ name: "Ada" });

    expect(await updateProfile(formData({ name: "a".repeat(81) }))).toEqual({
      success: false,
      error: "nameTooLong",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBe("Ada");
  });
});

describe("changePassword", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("rejects an incorrect current password", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe("old-hash");
  });

  it("requires the current password even with a valid session", async () => {
    // This is what stops a stolen session, or someone at an unlocked laptop,
    // from silently taking the account over for good.
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await changePassword(changeRequest());

    expect(verifyPassword).toHaveBeenCalledWith("the-old-password", "old-hash");
  });

  it("rejects setting the same password again", async () => {
    await signedInAsNewUser();
    // First call verifies the current password, second is the reuse check.
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "passwordReused",
    });
  });

  it("rejects a weak new password", async () => {
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const weak = "qwertyuiopasdfgh";

    expect(await changePassword(changeRequest({ password: weak, confirmPassword: weak }))).toEqual({
      success: false,
      error: "passwordWeak",
    });
  });

  it("refuses for an OAuth-only account with no password set", async () => {
    await signedInAsNewUser({ password: null });

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("AUTH-5: bumps passwordChangedAt and clears sessions on success", async () => {
    const user = await signedInAsNewUser();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(await changePassword(changeRequest())).toEqual({ success: true });

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe(`hashed:${NEW_PASSWORD}`);
    expect(found?.passwordChangedAt.getTime()).toBeGreaterThan(user.passwordChangedAt.getTime());
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses once the per-account rate limit is spent", async () => {
    await signedInAsNewUser();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
  });
});

describe("signOutEverywhere", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await signOutEverywhere()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("bumps the revocation clock and clears adapter sessions", async () => {
    const user = await signedInAsNewUser();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    expect(await signOutEverywhere()).toEqual({ success: true });

    // `passwordChangedAt` is the "sessions valid from" marker: every JWT
    // stamped before it is rejected at the next revalidation.
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.passwordChangedAt.getTime()).toBeGreaterThan(user.passwordChangedAt.getTime());
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("leaves the password untouched", async () => {
    const user = await signedInAsNewUser({ password: "old-hash" });

    await signOutEverywhere();

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe("old-hash");
  });
});

describe("unlinkAccount", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("disconnects a provider when a password remains", async () => {
    const user = await signedInAsNewUser({ password: "hash" });
    const account = await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({ success: true });
    expect(await prisma.account.findUnique({ where: { id: account.id } })).toBeNull();
  });

  it("disconnects one provider when another remains", async () => {
    const user = await signedInAsNewUser({ password: null });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "github",
        providerAccountId: "gh-1",
      },
    });

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({ success: true });
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses to remove the only way into a passwordless account", async () => {
    const user = await signedInAsNewUser({ password: null });
    const account = await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });

    // There would be no password to fall back on, and password reset skips
    // passwordless accounts — the user would be permanently locked out.
    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "lastSignInMethod",
    });
    expect(await prisma.account.findUnique({ where: { id: account.id } })).not.toBeNull();
  });

  it("is idempotent for a provider that is not linked", async () => {
    await signedInAsNewUser({ password: "hash" });

    expect(await unlinkAccount(formData({ provider: "github" }))).toEqual({ success: true });
  });
});

describe("deleteAccount", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await deleteAccount(formData({ password: "x" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("requires a password for a credential account", async () => {
    const user = await signedInAsNewUser();

    expect(await deleteAccount(formData({ password: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("rejects a wrong password without deleting anything", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await deleteAccount(formData({ password: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    // Deletion is irreversible and cascades, so this must never be best-effort.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("deletes the account when the password checks out", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("skips the password check for an OAuth-only account", async () => {
    const user = await signedInAsNewUser({ password: null });

    expect(await deleteAccount(formData({ password: "" }))).toEqual({ success: true });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});
