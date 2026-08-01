import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => false),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  })),
  resetRateLimit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/hash";
import { hashToken } from "@/lib/auth/tokens";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/client";
import { resetPassword } from "./reset-password";

const NEW_PASSWORD = "harbour-lentil-quilt";
const RAW_TOKEN = "a-raw-reset-token";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function validRequest(overrides: Record<string, string> = {}): FormData {
  return formData({
    token: RAW_TOKEN,
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ...overrides,
  });
}

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-1",
    userId: "user-1",
    tokenHash: hashToken(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    usedAt: null,
    user: { id: "user-1", email: "ada@example.com", password: "old-hash" },
    ...overrides,
  };
}

describe("resetPassword token validation", () => {
  beforeEach(() => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockClear();
    vi.mocked(verifyPassword).mockResolvedValue(false);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 14,
      retryAfterMs: 0,
    });
  });

  it("looks the token up by its hash, never by the raw value", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      tokenRecord() as never,
    );

    await resetPassword(validRequest());

    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken(RAW_TOKEN) } }),
    );
  });

  it("rejects a token that does not exist", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      tokenRecord({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a token that was already redeemed", async () => {
    // Single use: a link forwarded or left in an inbox must not work twice.
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      tokenRecord({ usedAt: new Date() }) as never,
    );

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("gives missing, expired and used tokens the same error", async () => {
    // Distinguishing them would tell a prober which tokens once existed.
    //
    // Sequential on purpose: the three cases share one mock, so running them
    // concurrently would leave the last `mockResolvedValue` in force for all of
    // them and the test would pass while only ever exercising one branch.
    const outcomes = [];

    for (const record of [
      null,
      tokenRecord({ expiresAt: new Date(Date.now() - 1000) }),
      tokenRecord({ usedAt: new Date() }),
    ]) {
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
        record as never,
      );
      outcomes.push(await resetPassword(validRequest()));
    }

    expect(outcomes).toEqual([
      { success: false, error: "tokenInvalid" },
      { success: false, error: "tokenInvalid" },
      { success: false, error: "tokenInvalid" },
    ]);
  });
});

describe("resetPassword password rules", () => {
  beforeEach(() => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      tokenRecord() as never,
    );
    vi.mocked(prisma.$transaction).mockClear();
    vi.mocked(verifyPassword).mockResolvedValue(false);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 14,
      retryAfterMs: 0,
    });
  });

  it("rejects a password below the minimum length", async () => {
    const short = "abcdefghijk";

    expect(
      await resetPassword(
        validRequest({ password: short, confirmPassword: short }),
      ),
    ).toEqual({ success: false, error: "passwordTooShort" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    expect(
      await resetPassword(
        validRequest({ confirmPassword: "something-else-entirely" }),
      ),
    ).toEqual({ success: false, error: "passwordsDoNotMatch" });
  });

  it("rejects reusing the password the account already has", async () => {
    // Whatever prompted the reset, keeping the same password leaves the
    // account exactly as exposed as before.
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "passwordReused",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("resetPassword success path", () => {
  beforeEach(() => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      tokenRecord() as never,
    );
    vi.mocked(prisma.$transaction).mockClear();
    vi.mocked(prisma.user.update).mockClear();
    vi.mocked(prisma.passwordResetToken.update).mockClear();
    vi.mocked(prisma.session.deleteMany).mockClear();
    vi.mocked(resetRateLimit).mockClear();
    vi.mocked(sendEmail).mockClear();
    vi.mocked(verifyPassword).mockResolvedValue(false);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 14,
      retryAfterMs: 0,
    });
  });

  it("stores the new password hashed and bumps passwordChangedAt", async () => {
    expect(await resetPassword(validRequest())).toEqual({ success: true });

    // Bumping passwordChangedAt is what revokes JWTs issued before the reset —
    // without it, whoever prompted the reset keeps their live session.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        password: `hashed:${NEW_PASSWORD}`,
        passwordChangedAt: expect.any(Date),
      },
    });
  });

  it("marks the token used and clears sessions in one transaction", async () => {
    await resetPassword(validRequest());

    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    // All of it in one transaction, so a token can never be consumed without
    // the password actually changing.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("clears the account's login lockout", async () => {
    await resetPassword(validRequest());

    // The user just proved control of the mailbox; the failed attempts that
    // led them here should not keep them locked out.
    expect(resetRateLimit).toHaveBeenCalledWith("login:email:ada@example.com");
  });

  it("notifies the account owner that the password changed", async () => {
    await resetPassword(validRequest());

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
    );
  });
});

describe("resetPassword rate limiting", () => {
  it("refuses once the budget is spent, without touching the token", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });
    vi.mocked(prisma.passwordResetToken.findUnique).mockClear();

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});
