import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createUser } from "@/test/factories/user";

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { sendEmail } from "@/lib/platform/email";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { requestPasswordReset } from "./actions";

function formData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
});

describe("requestPasswordReset action", () => {
  it("mints a token and emails a link for a known credential account", async () => {
    await createUser({ email: "ada@example.com", password: "hashed" });

    const result = await requestPasswordReset(formData({ email: "ada@example.com" }));

    expect(result).toEqual({ success: true });
    expect(await prisma.passwordResetToken.count()).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com" }));
  });

  it("stores only the token's hash, never the token itself", async () => {
    await createUser({ email: "ada@example.com", password: "hashed" });

    await requestPasswordReset(formData({ email: "ada@example.com" }));

    const [stored] = await prisma.passwordResetToken.findMany();
    const emailed = vi.mocked(sendEmail).mock.calls[0][0];

    // Pull the raw token back out of the emailed link and derive what the row
    // should hold. Hand-deriving it this way proves the column holds a digest
    // and not the token — a leaked database yields no working links.
    const tokenMatch = emailed.text.match(/token=(\S+)/);
    if (!tokenMatch) throw new Error("expected a token in the emailed link");
    const rawToken = decodeURIComponent(tokenMatch[1]);

    expect(stored.tokenHash).toBe(hashToken(rawToken));
    expect(stored.tokenHash).not.toBe(rawToken);
    // sha-256, hex encoded.
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invalidates outstanding tokens before issuing a new one", async () => {
    const user = await createUser({ email: "ada@example.com", password: "hashed" });
    const earlier = await prisma.passwordResetToken.create({
      data: {
        user: { connect: { id: user.id } },
        tokenHash: "earlier-hash",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await requestPasswordReset(formData({ email: "ada@example.com" }));

    // Otherwise every request leaves another live link sitting in an inbox.
    const found = await prisma.passwordResetToken.findUnique({ where: { id: earlier.id } });
    expect(found?.usedAt).not.toBeNull();
  });

  it("returns success without issuing anything for an unknown address", async () => {
    const result = await requestPasswordReset(formData({ email: "nobody-here@example.com" }));

    // Identical response to the known-account case: that is the whole point.
    expect(result).toEqual({ success: true });
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns success without issuing anything for an OAuth-only account", async () => {
    await createUser({ email: "oauth@example.com", password: null });

    const result = await requestPasswordReset(formData({ email: "oauth@example.com" }));

    expect(result).toEqual({ success: true });
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("still reports success when issuing the token throws", async () => {
    await createUser({ email: "ada@example.com", password: "hashed" });
    vi.spyOn(prisma.passwordResetToken, "create").mockRejectedValueOnce(new Error("database down"));

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
