import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { deriveCodeFromUri } from "@/test/two-factor-totp";

// BAUTH-11 (docs/specs/core-better-auth.md): every case here moved onto
// Better Auth's own `twoFactor` plugin — `auth.api.enableTwoFactor`,
// `verifyTOTP`, `disableTwoFactor` and `generateBackupCodes` — in place of
// lib/auth/two-factor/* (deleted). `getCurrentUser` is mocked the same way
// the pre-cutover version of this file mocked it, but the plugin's own
// endpoints still need a *real* signed session in `headers()`, since they
// resolve the caller through Better Auth's own session middleware, not
// through our mock.

// The real plaintext behind test/factories/user.ts's default password hash —
// using it lets every case below sign in through Better Auth for real,
// rather than mocking password verification.
const FACTORY_PASSWORD = "buycarmap-factory-password";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

const requestHeaders = { current: new Headers() };
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: vi.fn(async () => requestHeaders.current),
}));

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));

import { getCurrentUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { auth, createSessionCookie } from "@/lib/auth/auth";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

/** Creates a real user and a real Better Auth session for it, and points
 * `getCurrentUser()`/`headers()` at both — regardless of the account's
 * two-factor state, unlike signing in through `auth.api.signInEmail`, which
 * would redirect into the two-factor challenge instead of returning a token. */
async function signedInAsNewUser(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });

  const cookie = await createSessionCookie(user.id);
  requestHeaders.current = new Headers({ cookie: `${cookie.name}=${cookie.value}` });

  return user;
}

/**
 * Enrols a real, verified two-factor secret for the signed-in user.
 *
 * Better Auth's own `verifyTOTP` deletes the session behind the cookie it
 * was called with and mints a fresh one when it first confirms enrolment
 * (its own behaviour, not something this phase changes) — so this re-signs a
 * current session afterward, or every later call in the same test would
 * carry a cookie for a session that no longer exists.
 */
async function enrolRealTwoFactor(userId: string, password = FACTORY_PASSWORD) {
  const enabled = await auth.api.enableTwoFactor({
    body: { password },
    headers: requestHeaders.current,
  });

  if (enabled.method !== "totp" || !enabled.totpURI) {
    throw new Error("expected a TOTP enrolment");
  }

  await auth.api.verifyTOTP({
    body: { code: deriveCodeFromUri(enabled.totpURI) },
    headers: requestHeaders.current,
  });

  const cookie = await createSessionCookie(userId);
  requestHeaders.current = new Headers({ cookie: `${cookie.name}=${cookie.value}` });

  return enabled;
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  requestHeaders.current = new Headers();
});

describe("startTwoFactorSetup", () => {
  it("refuses for an OAuth-only account", async () => {
    await signedInAsNewUser({ email: "oauth@example.com", password: null });

    expect(await startTwoFactorSetup(formData({ password: "anything" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses when two-factor is already on", async () => {
    const user = await signedInAsNewUser({ email: "enrolled@example.com" });
    await enrolRealTwoFactor(user.id);

    expect(await startTwoFactorSetup(formData({ password: FACTORY_PASSWORD }))).toEqual(
      expect.objectContaining({ success: false, error: "totpAlreadyEnabled" }),
    );
  });

  it("rejects the wrong password", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });

    expect(await startTwoFactorSetup(formData({ password: "not-the-password" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
  });

  it("mints a scannable URI and ten recovery codes, and leaves two-factor off", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });

    const result = await startTwoFactorSetup(formData({ password: FACTORY_PASSWORD }));

    expect(result.success).toBe(true);
    expect(result.otpauthUri).toContain("otpauth://totp/");
    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.recoveryCodes).toHaveLength(10);

    // Enabling here would lock out anyone whose authenticator never worked.
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(false);
    const row = await prisma.twoFactor.findFirst({ where: { userId: user.id } });
    expect(row?.verified).toBe(false);
  });
});

describe("confirmTwoFactorSetup", () => {
  it("refuses when setup was never started", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });

    expect(await confirmTwoFactorSetup(formData({ code: "000000" }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("rejects a wrong code and leaves two-factor off", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    await startTwoFactorSetup(formData({ password: FACTORY_PASSWORD }));

    expect(await confirmTwoFactorSetup(formData({ code: "000000" }))).toEqual({
      success: false,
      error: "totpInvalid",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(false);
  });

  it("AUTH-9: enables two-factor on a valid 6-digit, 30s-step code", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    const setup = await startTwoFactorSetup(formData({ password: FACTORY_PASSWORD }));
    if (!setup.otpauthUri) throw new Error("expected a URI");

    const result = await confirmTwoFactorSetup(
      formData({ code: deriveCodeFromUri(setup.otpauthUri) }),
    );

    expect(result).toEqual({ success: true });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(true);
    const row = await prisma.twoFactor.findFirst({ where: { userId: user.id } });
    expect(row?.verified).toBe(true);
  });

  it("refuses once the rate limit is spent", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });
    await startTwoFactorSetup(formData({ password: FACTORY_PASSWORD }));
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await confirmTwoFactorSetup(formData({ code: "123456" }))).toEqual({
      success: false,
      error: "rateLimited",
    });
  });
});

describe("disableTwoFactor", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await disableTwoFactor(formData({ currentPassword: FACTORY_PASSWORD }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("rejects an empty password before checking anything else", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });

    expect(await disableTwoFactor(formData({ currentPassword: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
  });

  it("refuses once the rate limit is spent", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await disableTwoFactor(formData({ currentPassword: FACTORY_PASSWORD }))).toEqual({
      success: false,
      error: "rateLimited",
    });
  });

  it("refuses when two-factor is not on", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });

    expect(
      await disableTwoFactor(formData({ currentPassword: FACTORY_PASSWORD, code: "123456" })),
    ).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("BAUTH-11: correct password plus wrong code refuses and leaves two-factor on", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    await enrolRealTwoFactor(user.id);

    expect(
      await disableTwoFactor(formData({ currentPassword: FACTORY_PASSWORD, code: "000000" })),
    ).toEqual({
      success: false,
      error: "totpInvalid",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(true);
  });

  it("BAUTH-11: wrong password plus correct code refuses and leaves two-factor on", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    const enrolled = await enrolRealTwoFactor(user.id);

    expect(
      await disableTwoFactor(
        formData({ currentPassword: "wrong", code: deriveCodeFromUri(enrolled.totpURI) }),
      ),
    ).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(true);
  });

  it("BAUTH-11: correct password plus correct code clears the secret and every recovery code", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    const enrolled = await enrolRealTwoFactor(user.id);

    expect(
      await disableTwoFactor(
        formData({ currentPassword: FACTORY_PASSWORD, code: deriveCodeFromUri(enrolled.totpURI) }),
      ),
    ).toEqual({
      success: true,
    });

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabled).toBe(false);
    expect(await prisma.twoFactor.findFirst({ where: { userId: user.id } })).toBeNull();
  });
});

describe("regenerateRecoveryCodes", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: FACTORY_PASSWORD }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses once the rate limit is spent", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await regenerateRecoveryCodes(formData({ currentPassword: FACTORY_PASSWORD }))).toEqual({
      success: false,
      error: "rateLimited",
    });
  });

  it("requires the password", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    await enrolRealTwoFactor(user.id);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
  });

  it("refuses when two-factor is not on", async () => {
    await signedInAsNewUser({ email: "ada@example.com" });

    expect(await regenerateRecoveryCodes(formData({ currentPassword: FACTORY_PASSWORD }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("rejects a wrong password", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    await enrolRealTwoFactor(user.id);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
  });

  it("AUTH-10: replaces the previous set with ten fresh, working codes", async () => {
    const user = await signedInAsNewUser({ email: "ada@example.com" });
    const enrolled = await enrolRealTwoFactor(user.id);

    const result = await regenerateRecoveryCodes(formData({ currentPassword: FACTORY_PASSWORD }));

    expect(result.success).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(result.recoveryCodes).not.toEqual(enrolled.backupCodes);
  });
});
