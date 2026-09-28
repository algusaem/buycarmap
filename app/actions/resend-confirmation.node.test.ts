import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingRegistration: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { resendConfirmation } from "./resend-confirmation";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const pending = {
  id: "pending-1",
  email: "ada@example.com",
  password: "$2b$12$alreadyhashed",
  name: "Ada",
};

beforeEach(() => {
  vi.mocked(prisma.pendingRegistration.findFirst).mockReset();
  vi.mocked(prisma.pendingRegistration.update).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  });
});

describe("resendConfirmation", () => {
  it("rotates the token and emails a fresh link", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockResolvedValue(pending as never);

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: true,
    });

    const updated = vi.mocked(prisma.pendingRegistration.update).mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    const tokenMatch = sent.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    // The emailed token must be the one now stored, hashed.
    expect(updated.data.tokenHash).toBe(hashToken(rawToken));
  });

  it("updates in place rather than adding a row, so one link is live", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockResolvedValue(pending as never);

    await resendConfirmation(formData({ email: "ada@example.com" }));

    expect(prisma.pendingRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pending-1" } }),
    );
  });

  it("never re-collects the password", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockResolvedValue(pending as never);

    await resendConfirmation(formData({ email: "ada@example.com" }));

    const updated = vi.mocked(prisma.pendingRegistration.update).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // The hash from the original submission is reused untouched.
    expect(updated.data).not.toHaveProperty("password");
  });

  it("returns the same success when no pending signup exists", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockResolvedValue(null);

    // Identical to the found case: this must not become a second way to learn
    // whether an address has a signup in flight.
    expect(await resendConfirmation(formData({ email: "nobody@example.com" }))).toEqual({
      success: true,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ignores an expired pending signup", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockResolvedValue(null);

    await resendConfirmation(formData({ email: "ada@example.com" }));

    const query = vi.mocked(prisma.pendingRegistration.findFirst).mock.calls[0][0] as {
      where: { expiresAt: { gt: Date } };
    };
    // Resending would otherwise revive a signup the user abandoned days ago.
    expect(query.where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("returns success when the database throws", async () => {
    vi.mocked(prisma.pendingRegistration.findFirst).mockRejectedValue(new Error("database down"));

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: true,
    });
  });

  it("refuses once the rate limit is spent", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    expect(await resendConfirmation(formData({ email: "nope" }))).toEqual({
      success: false,
      error: "emailInvalid",
    });
  });
});
