import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailVerificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/hash", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/auth/cleanup", () => ({
  maybePruneExpiredAuthRows: vi.fn(async () => undefined),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { hashToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  confirmEmail,
  requestEmailChange,
  requestEmailVerification,
} from "./email-verification";

const SESSION_USER = { id: "user-1", email: "ada@example.com" };
const RAW_TOKEN = "a-raw-verification-token";
const PASSWORD = "the-current-password";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function changeRequest(overrides: Record<string, string> = {}): FormData {
  return formData({
    email: "new@example.com",
    currentPassword: PASSWORD,
    ...overrides,
  });
}

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-1",
    userId: "user-1",
    newEmail: null,
    tokenHash: hashToken(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    user: { id: "user-1", email: "ada@example.com" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.emailVerificationToken.findUnique).mockReset();
  vi.mocked(prisma.emailVerificationToken.create).mockReset();
  vi.mocked(prisma.emailVerificationToken.updateMany).mockReset();
  vi.mocked(prisma.$transaction).mockClear();
  vi.mocked(prisma.$transaction).mockResolvedValue([]);
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 5,
    retryAfterMs: 0,
  });
});

describe("requestEmailVerification", () => {
  beforeEach(() => vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER));

  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await requestEmailVerification()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("sends a link to the address already on the account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      emailVerified: null,
    } as never);

    expect(await requestEmailVerification()).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
    );
  });

  it("refuses when the address is already verified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      emailVerified: new Date(),
    } as never);

    // Nothing to prove, so this would only be a way to send yourself mail.
    expect(await requestEmailVerification()).toEqual({
      success: false,
      error: "alreadyVerified",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("retires any earlier outstanding token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      emailVerified: null,
    } as never);

    await requestEmailVerification();

    // Otherwise an old link from a previous request stays live.
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });
});

describe("requestEmailChange", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);
    vi.mocked(prisma.user.findUnique).mockImplementation((async (args: {
      where: { id?: string; email?: string };
    }) => {
      // First lookup is the current user; second checks the target address.
      if (args.where.id) {
        return { email: "ada@example.com", password: "old-hash" };
      }
      return null;
    }) as never);
  });

  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("requires the current password", async () => {
    // A hijacked session alone must not be enough to move the account to an
    // inbox the attacker controls.
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the link to the NEW address, never the current one", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await requestEmailChange(changeRequest());

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    // The point of the flow: you only get the account moved if you can read
    // mail at the destination.
    expect(sent.to).toBe("new@example.com");
    expect(sent.to).not.toBe("ada@example.com");
  });

  it("stores the target address on the token", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await requestEmailChange(changeRequest());

    const created = vi.mocked(prisma.emailVerificationToken.create).mock
      .calls[0][0] as { data: { newEmail: string | null } };
    expect(created.data.newEmail).toBe("new@example.com");
  });

  it("rejects changing to the address already in use", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(
      await requestEmailChange(changeRequest({ email: "ada@example.com" })),
    ).toEqual({ success: false, error: "sameEmail" });
  });

  it("returns the same success for a taken target, and sends nothing", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockImplementation((async (args: {
      where: { id?: string; email?: string };
    }) => {
      if (args.where.id) {
        return { email: "ada@example.com", password: "old-hash" };
      }
      return { id: "someone-else" };
    }) as never);

    // Identical to the free-address response, so a signed-in user cannot probe
    // which addresses are registered.
    expect(await requestEmailChange(changeRequest())).toEqual({
      success: true,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it("refuses for an OAuth-only account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "oauth@example.com",
      password: null,
    } as never);

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses once the rate limit is spent", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
  });
});

describe("confirmEmail", () => {
  it("rejects a missing token", async () => {
    expect(await confirmEmail(formData({ token: "" }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("rejects an expired token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      tokenRecord({ expiresAt: new Date(Date.now() - 1000) }) as never,
    );

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an already-used token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      tokenRecord({ usedAt: new Date() }) as never,
    );

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("verifies the existing address when newEmail is null", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      tokenRecord() as never,
    );

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: true,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      // No `email` key: the address is unchanged, only proven.
      data: { emailVerified: expect.any(Date) },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("moves the account and notifies the old address on a change", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      tokenRecord({ newEmail: "new@example.com" }) as never,
    );

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: true,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "new@example.com",
        emailVerified: expect.any(Date),
      },
    });
    // The previous owner has to hear about it to react if it wasn't them.
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
    );
  });

  it("reports a taken address if it was claimed in the meantime", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      tokenRecord({ newEmail: "new@example.com" }) as never,
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "emailTaken",
    });
  });
});
