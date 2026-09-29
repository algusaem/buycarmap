import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: { updateMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { hashToken } from "@/lib/auth/tokens";
import { requestPasswordReset } from "./actions";

function formData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

const credentialUser = { id: "user-1", password: "hashed" };

describe("requestPasswordReset action", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.passwordResetToken.updateMany).mockReset();
    vi.mocked(prisma.passwordResetToken.create).mockReset();
    vi.mocked(sendEmail).mockClear();
    vi.mocked(consumeRateLimit).mockClear();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
    });
  });

  it("mints a token and emails a link for a known credential account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(credentialUser as never);

    const result = await requestPasswordReset(formData({ email: "ada@example.com" }));

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com" }));
  });

  it("stores only the token's hash, never the token itself", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(credentialUser as never);

    await requestPasswordReset(formData({ email: "ada@example.com" }));

    const stored = vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    const emailed = vi.mocked(sendEmail).mock.calls[0][0];

    // Pull the raw token back out of the emailed link and derive what the row
    // should hold. Hand-deriving it this way proves the column holds a digest
    // and not the token — a leaked database yields no working links.
    const tokenMatch = emailed.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    expect(stored.data.tokenHash).toBe(hashToken(rawToken));
    expect(stored.data.tokenHash).not.toBe(rawToken);
    // sha-256, hex encoded.
    expect(stored.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invalidates outstanding tokens before issuing a new one", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(credentialUser as never);

    await requestPasswordReset(formData({ email: "ada@example.com" }));

    // Otherwise every request leaves another live link sitting in an inbox.
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("returns success without issuing anything for an unknown address", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await requestPasswordReset(formData({ email: "nobody-here@example.com" }));

    // Identical response to the known-account case: that is the whole point.
    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns success without issuing anything for an OAuth-only account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      password: null,
    } as never);

    const result = await requestPasswordReset(formData({ email: "oauth@example.com" }));

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("still reports success when issuing the token throws", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(credentialUser as never);
    vi.mocked(prisma.passwordResetToken.create).mockRejectedValue(new Error("database down"));

    const result = await requestPasswordReset(formData({ email: "ada@example.com" }));

    // An error response here would tell an attacker the account exists.
    expect(result).toEqual({ success: true });
  });

  it("refuses once the rate limit is exhausted", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    const result = await requestPasswordReset(formData({ email: "ada@example.com" }));

    expect(result).toEqual({ success: false, error: "rateLimited" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email with the schema's code", async () => {
    const result = await requestPasswordReset(formData({ email: "nope" }));
    expect(result).toEqual({ success: false, error: "emailInvalid" });
  });

  it("rejects an empty email as required", async () => {
    // The form always submits the field, so the empty case is a blank string.
    const result = await requestPasswordReset(formData({ email: "" }));
    expect(result).toEqual({ success: false, error: "emailRequired" });
  });
});
