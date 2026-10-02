import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createUser } from "@/test/factories/user";

vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => false),
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  })),
  resetRateLimit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit, resetRateLimit } from "@/server/rate-limit/service";
import { sendEmail } from "@/lib/email/client";
import { resetPassword } from "./actions";

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

async function seedToken(
  overrides: { expiresAt?: Date; usedAt?: Date | null; userPassword?: string | null } = {},
) {
  const user = await createUser({
    email: "ada@example.com",
    password: overrides.userPassword ?? "old-hash",
  });
  const token = await prisma.passwordResetToken.create({
    data: {
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
      usedAt: overrides.usedAt ?? null,
    },
  });
  return { user, token };
}

beforeEach(() => {
  vi.mocked(verifyPassword).mockResolvedValue(false);
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 14,
    retryAfterMs: 0,
  });
  vi.mocked(resetRateLimit).mockClear();
  vi.mocked(sendEmail).mockClear();
});

describe("resetPassword token validation", () => {
  it("looks the token up by its hash, never by the raw value", async () => {
    await seedToken();
    const spy = vi.spyOn(prisma.passwordResetToken, "findUnique");

    await resetPassword(validRequest());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken(RAW_TOKEN) } }),
    );
    spy.mockRestore();
  });

  it("rejects a token that does not exist", async () => {
    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("rejects an expired token", async () => {
    await seedToken({ expiresAt: new Date(Date.now() - 1000) });

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("rejects a token that was already redeemed", async () => {
    // Single use: a link forwarded or left in an inbox must not work twice.
    await seedToken({ usedAt: new Date() });

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("gives missing, expired and used tokens the same error", async () => {
    // Distinguishing them would tell a prober which tokens once existed.
    const missing = await resetPassword(validRequest());

    await seedToken({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await resetPassword(validRequest());

    await prisma.passwordResetToken.deleteMany();
    await seedToken({ usedAt: new Date() });
    const used = await resetPassword(validRequest());

    expect([missing, expired, used]).toEqual([
      { success: false, error: "tokenInvalid" },
      { success: false, error: "tokenInvalid" },
      { success: false, error: "tokenInvalid" },
    ]);
  });
});

describe("resetPassword password rules", () => {
  it("rejects a password below the minimum length", async () => {
    await seedToken();
    const short = "abcdefghijk";

    expect(await resetPassword(validRequest({ password: short, confirmPassword: short }))).toEqual({
      success: false,
      error: "passwordTooShort",
    });
  });

  it("rejects mismatched confirmation", async () => {
    await seedToken();

    expect(
      await resetPassword(validRequest({ confirmPassword: "something-else-entirely" })),
    ).toEqual({ success: false, error: "passwordsDoNotMatch" });
  });

  it("rejects reusing the password the account already has", async () => {
    // Whatever prompted the reset, keeping the same password leaves the
    // account exactly as exposed as before.
    await seedToken();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "passwordReused",
    });
  });
});

describe("resetPassword success path", () => {
  it("stores the new password hashed and bumps passwordChangedAt", async () => {
    const { user } = await seedToken();

    expect(await resetPassword(validRequest())).toEqual({ success: true });

    // Bumping passwordChangedAt is what revokes JWTs issued before the reset —
    // without it, whoever prompted the reset keeps their live session.
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe(`hashed:${NEW_PASSWORD}`);
    expect(found?.passwordChangedAt.getTime()).toBeGreaterThan(user.passwordChangedAt.getTime());
  });

  it("AUTH-11: leaves two-factor enrolment untouched, so a reset cannot bypass it", async () => {
    const encrypted = "v1:encrypted-secret";
    const { user } = await seedToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encrypted, twoFactorEnabledAt: new Date() },
    });

    // Control of the mailbox is enough to reset a password. If the reset also
    // cleared the second factor, the mailbox alone would defeat 2FA entirely —
    // which is the whole thing 2FA exists to prevent.
    await resetPassword(validRequest());

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorSecret).toBe(encrypted);
    expect(found?.twoFactorEnabledAt).not.toBeNull();
  });

  it("marks the token used and clears sessions in one transaction", async () => {
    const { user, token } = await seedToken();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await resetPassword(validRequest());

    const foundToken = await prisma.passwordResetToken.findUnique({ where: { id: token.id } });
    expect(foundToken?.usedAt).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("clears the account's login lockout", async () => {
    await seedToken();

    await resetPassword(validRequest());

    // The user just proved control of the mailbox; the failed attempts that
    // led them here should not keep them locked out.
    expect(resetRateLimit).toHaveBeenCalledWith("login:email:ada@example.com");
  });

  it("notifies the account owner that the password changed", async () => {
    await seedToken();

    await resetPassword(validRequest());

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com" }));
  });
});

describe("resetPassword rate limiting", () => {
  it("refuses once the budget is spent, without touching the token", async () => {
    const { token } = await seedToken();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await resetPassword(validRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
    const found = await prisma.passwordResetToken.findUnique({ where: { id: token.id } });
    expect(found?.usedAt).toBeNull();
  });
});
