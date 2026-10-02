import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createEmailVerificationToken } from "@/test/factories/auth-tokens";
import { createUser } from "@/test/factories/user";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/hash", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/server/auth/service", () => ({
  maybePruneExpiredAuthRows: vi.fn(async () => undefined),
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { confirmEmail, requestEmailChange, requestEmailVerification } from "./actions";

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

async function signedInAsNewUser(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({
    email: "ada@example.com",
    password: "old-hash",
    ...overrides,
  });
  vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });
  return user;
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 5,
    retryAfterMs: 0,
  });
});

describe("requestEmailVerification", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await requestEmailVerification()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("sends a link to the address already on the account", async () => {
    await signedInAsNewUser({ emailVerified: null });

    expect(await requestEmailVerification()).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com" }));
  });

  it("refuses when the address is already verified", async () => {
    await signedInAsNewUser({ emailVerified: new Date() });

    // Nothing to prove, so this would only be a way to send yourself mail.
    expect(await requestEmailVerification()).toEqual({
      success: false,
      error: "alreadyVerified",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("retires any earlier outstanding token", async () => {
    const user = await signedInAsNewUser({ emailVerified: null });
    const earlier = await createEmailVerificationToken({
      user: { connect: { id: user.id } },
    });

    await requestEmailVerification();

    // Otherwise an old link from a previous request stays live.
    const found = await prisma.emailVerificationToken.findUnique({ where: { id: earlier.id } });
    expect(found?.usedAt).not.toBeNull();
  });
});

describe("requestEmailChange", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("AUTH-13: requires the current password", async () => {
    // A hijacked session alone must not be enough to move the account to an
    // inbox the attacker controls.
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("AUTH-13: sends the link to the NEW address, never the current one", async () => {
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await requestEmailChange(changeRequest());

    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    // The point of the flow: you only get the account moved if you can read
    // mail at the destination.
    expect(sent.to).toBe("new@example.com");
    expect(sent.to).not.toBe("ada@example.com");
  });

  it("stores the target address on the token", async () => {
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await requestEmailChange(changeRequest());

    const [token] = await prisma.emailVerificationToken.findMany({
      orderBy: { createdAt: "desc" },
    });
    expect(token.newEmail).toBe("new@example.com");
  });

  it("rejects changing to the address already in use", async () => {
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await requestEmailChange(changeRequest({ email: "ada@example.com" }))).toEqual({
      success: false,
      error: "sameEmail",
    });
  });

  it("returns the same success for a taken target, and sends nothing", async () => {
    await signedInAsNewUser();
    await createUser({ email: "new@example.com" });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    // Identical to the free-address response, so a signed-in user cannot probe
    // which addresses are registered.
    expect(await requestEmailChange(changeRequest())).toEqual({ success: true });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.emailVerificationToken.count()).toBe(0);
  });

  it("refuses for an OAuth-only account", async () => {
    await signedInAsNewUser({ email: "oauth@example.com", password: null });

    expect(await requestEmailChange(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses once the rate limit is spent", async () => {
    await signedInAsNewUser();
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
    const user = await createUser({ email: "ada@example.com" });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("rejects an already-used token", async () => {
    const user = await createUser({ email: "ada@example.com" });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      usedAt: new Date(),
    });

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "tokenInvalid",
    });
  });

  it("verifies the existing address when newEmail is null", async () => {
    const user = await createUser({ email: "ada@example.com" });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      newEmail: null,
    });

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({ success: true });

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    // No `email` change: the address is unchanged, only proven.
    expect(found?.email).toBe("ada@example.com");
    expect(found?.emailVerified).not.toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("moves the account and notifies the old address on a change", async () => {
    const user = await createUser({ email: "ada@example.com" });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      newEmail: "new@example.com",
    });

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({ success: true });

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe("new@example.com");
    expect(found?.emailVerified).not.toBeNull();
    // The previous owner has to hear about it to react if it wasn't them.
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com" }));
  });

  it("reports a taken address if it was claimed in the meantime", async () => {
    const user = await createUser({ email: "ada@example.com" });
    await createEmailVerificationToken({
      user: { connect: { id: user.id } },
      tokenHash: hashToken(RAW_TOKEN),
      newEmail: "new@example.com",
    });
    await createUser({ email: "new@example.com" });

    expect(await confirmEmail(formData({ token: RAW_TOKEN }))).toEqual({
      success: false,
      error: "emailTaken",
    });
  });
});
