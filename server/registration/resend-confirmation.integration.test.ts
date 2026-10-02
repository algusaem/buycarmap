import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { resendConfirmation } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seedPending(overrides: { expiresAt?: Date } = {}) {
  return prisma.pendingRegistration.create({
    data: {
      email: "ada@example.com",
      password: "$2b$12$alreadyhashed",
      name: "Ada",
      tokenHash: "original-token-hash",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  });
});

describe("resendConfirmation", () => {
  it("rotates the token and emails a fresh link", async () => {
    const pending = await seedPending();

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: true,
    });

    const updated = await prisma.pendingRegistration.findUnique({ where: { id: pending.id } });
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    const tokenMatch = sent.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    // The emailed token must be the one now stored, hashed.
    expect(updated?.tokenHash).toBe(hashToken(rawToken));
  });

  it("updates in place rather than adding a row, so one link is live", async () => {
    await seedPending();

    await resendConfirmation(formData({ email: "ada@example.com" }));

    expect(await prisma.pendingRegistration.count({ where: { email: "ada@example.com" } })).toBe(1);
  });

  it("never re-collects the password", async () => {
    const pending = await seedPending();

    await resendConfirmation(formData({ email: "ada@example.com" }));

    // The hash from the original submission is reused untouched.
    const updated = await prisma.pendingRegistration.findUnique({ where: { id: pending.id } });
    expect(updated?.password).toBe(pending.password);
  });

  it("returns the same success when no pending signup exists", async () => {
    // Identical to the found case: this must not become a second way to learn
    // whether an address has a signup in flight.
    expect(await resendConfirmation(formData({ email: "nobody@example.com" }))).toEqual({
      success: true,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ignores an expired pending signup", async () => {
    const pending = await seedPending({ expiresAt: new Date(Date.now() - 1000) });

    await resendConfirmation(formData({ email: "ada@example.com" }));

    // Resending would otherwise revive a signup the user abandoned days ago.
    expect(sendEmail).not.toHaveBeenCalled();
    const untouched = await prisma.pendingRegistration.findUnique({ where: { id: pending.id } });
    expect(untouched?.tokenHash).toBe("original-token-hash");
  });

  it("returns success when the database throws", async () => {
    vi.spyOn(prisma.pendingRegistration, "findFirst").mockRejectedValueOnce(
      new Error("database down"),
    );

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: true,
    });
  });
});
