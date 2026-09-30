import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";

const { KEY } = vi.hoisted(() => ({
  KEY: Buffer.alloc(32, 7).toString("base64"),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/hash", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: { TWO_FACTOR_ENCRYPTION_KEY: KEY },
}));
vi.mock("@/lib/app-config", () => ({
  isTwoFactorConfigured: true,
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/server/two-factor/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/two-factor/service")>()),
  verifyAndConsumeTwoFactor: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { verifyAndConsumeTwoFactor } from "@/server/two-factor/service";
import { decryptSecret, encryptSecret } from "@/lib/auth/two-factor/encryption";
import { deriveCode, generateTotpSecret, stepForTime } from "@/lib/auth/two-factor/totp";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "./actions";

const SECRET = generateTotpSecret();
const ENCRYPTED = encryptSecret(SECRET, KEY);

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

// Frozen for the same reason as verify.node.test.ts: the confirming step is
// asserted against a recomputed clock read.
const NOW = 1_800_000_000_000;
const CURRENT_STEP = stepForTime(NOW);
const currentCode = () => deriveCode(SECRET, CURRENT_STEP);

async function signedInAsNewUser(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ email: "ada@example.com", password: "hash", ...overrides });
  vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });
  return user;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(verifyAndConsumeTwoFactor).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startTwoFactorSetup", () => {
  it("refuses for an OAuth-only account", async () => {
    await signedInAsNewUser({ email: "oauth@example.com", password: null });

    expect(await startTwoFactorSetup()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses when two-factor is already on", async () => {
    await signedInAsNewUser({ twoFactorEnabledAt: new Date() });

    expect(await startTwoFactorSetup()).toEqual({
      success: false,
      error: "totpAlreadyEnabled",
    });
  });

  it("stores the secret encrypted, never in the clear", async () => {
    const user = await signedInAsNewUser();

    const result = await startTwoFactorSetup();
    const found = await prisma.user.findUnique({ where: { id: user.id } });

    expect(result.success).toBe(true);
    expect(found?.twoFactorSecret).not.toBe(result.secret);
    expect(found?.twoFactorSecret?.startsWith("v1:")).toBe(true);
    // What was persisted must decrypt back to what the user was shown.
    if (!found?.twoFactorSecret || !result.secret)
      throw new Error("expected both secrets to be set");
    expect(decryptSecret(found.twoFactorSecret, KEY)).toBe(result.secret);
  });

  it("leaves two-factor switched off until a code is confirmed", async () => {
    const user = await signedInAsNewUser();

    await startTwoFactorSetup();
    const found = await prisma.user.findUnique({ where: { id: user.id } });

    // Enabling here would lock out anyone whose authenticator never worked.
    expect(found?.twoFactorEnabledAt).toBeNull();
  });

  it("returns a scannable URI carrying the account email", async () => {
    await signedInAsNewUser();

    const { otpauthUri } = await startTwoFactorSetup();

    expect(otpauthUri).toContain("otpauth://totp/");
    expect(decodeURIComponent(otpauthUri as string)).toContain("ada@example.com");
  });
});

describe("confirmTwoFactorSetup", () => {
  it("rejects a wrong code and leaves two-factor off", async () => {
    const user = await signedInAsNewUser({ twoFactorSecret: ENCRYPTED, twoFactorEnabledAt: null });

    expect(await confirmTwoFactorSetup(formData({ code: "000000" }))).toEqual({
      success: false,
      error: "totpInvalid",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabledAt).toBeNull();
  });

  it("refuses when setup was never started", async () => {
    await signedInAsNewUser({ twoFactorSecret: null, twoFactorEnabledAt: null });

    expect(await confirmTwoFactorSetup(formData({ code: currentCode() }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("enables two-factor and returns ten recovery codes on a valid code", async () => {
    const user = await signedInAsNewUser({ twoFactorSecret: ENCRYPTED, twoFactorEnabledAt: null });

    const result = await confirmTwoFactorSetup(formData({ code: currentCode() }));

    expect(result.success).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(10);
  });

  it("returns codes only in this response, never storing them readable", async () => {
    await signedInAsNewUser({ twoFactorSecret: ENCRYPTED, twoFactorEnabledAt: null });

    const result = await confirmTwoFactorSetup(formData({ code: currentCode() }));

    const stored = await prisma.twoFactorRecoveryCode.findMany();
    for (const code of result.recoveryCodes ?? []) {
      expect(JSON.stringify(stored)).not.toContain(code);
    }
  });

  it("records the confirming step so it cannot be replayed at login", async () => {
    const user = await signedInAsNewUser({ twoFactorSecret: ENCRYPTED, twoFactorEnabledAt: null });

    await confirmTwoFactorSetup(formData({ code: currentCode() }));

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorEnabledAt).not.toBeNull();
    expect(found?.twoFactorLastStep).toBe(CURRENT_STEP);
  });

  it("refuses once the rate limit is spent", async () => {
    await signedInAsNewUser({ twoFactorSecret: ENCRYPTED, twoFactorEnabledAt: null });
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await confirmTwoFactorSetup(formData({ code: currentCode() }))).toEqual({
      success: false,
      error: "rateLimited",
    });
  });
});

describe("disableTwoFactor", () => {
  async function signedInWithTwoFactorEnabled() {
    return signedInAsNewUser({
      password: "hash",
      twoFactorSecret: ENCRYPTED,
      twoFactorEnabledAt: new Date(),
      twoFactorLastStep: null,
    });
  }

  it("refuses when two-factor is not on", async () => {
    await signedInAsNewUser({ password: "hash", twoFactorEnabledAt: null });

    expect(await disableTwoFactor(formData({ currentPassword: "pw", code: "123456" }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("rejects a wrong password before looking at the code", async () => {
    await signedInWithTwoFactorEnabled();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await disableTwoFactor(formData({ currentPassword: "wrong", code: "123456" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });

  it("rejects a right password with a wrong code", async () => {
    // Both are required: a stolen session lacks the password, and knowing the
    // password alone should not undo the second factor.
    const user = await signedInWithTwoFactorEnabled();
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({ valid: false, method: null });

    expect(
      await disableTwoFactor(formData({ currentPassword: "correct", code: "000000" })),
    ).toEqual({ success: false, error: "totpInvalid" });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorSecret).toBe(ENCRYPTED);
  });

  it("clears the secret and every recovery code on success", async () => {
    const user = await signedInWithTwoFactorEnabled();
    await prisma.twoFactorRecoveryCode.create({
      data: { user: { connect: { id: user.id } }, codeHash: "some-code-hash" },
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({ valid: true, method: "totp" });

    expect(
      await disableTwoFactor(formData({ currentPassword: "correct", code: "123456" })),
    ).toEqual({ success: true });

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorSecret).toBeNull();
    expect(found?.twoFactorEnabledAt).toBeNull();
    expect(found?.twoFactorLastStep).toBeNull();
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("regenerateRecoveryCodes", () => {
  async function signedInWithTwoFactorEnabled() {
    return signedInAsNewUser({ password: "hash", twoFactorEnabledAt: new Date() });
  }

  it("requires the password", async () => {
    await signedInWithTwoFactorEnabled();

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
  });

  it("rejects a wrong password", async () => {
    await signedInWithTwoFactorEnabled();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
  });

  it("does not demand a code, since the usual reason to be here is losing them", async () => {
    await signedInWithTwoFactorEnabled();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await regenerateRecoveryCodes(formData({ currentPassword: "correct" }));

    expect(result.success).toBe(true);
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });

  it("replaces the previous set rather than adding to it", async () => {
    const user = await signedInWithTwoFactorEnabled();
    await prisma.twoFactorRecoveryCode.create({
      data: { user: { connect: { id: user.id } }, codeHash: "old-code-hash" },
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await regenerateRecoveryCodes(formData({ currentPassword: "correct" }));

    expect(result.recoveryCodes).toHaveLength(10);
    expect(
      await prisma.twoFactorRecoveryCode.findFirst({ where: { codeHash: "old-code-hash" } }),
    ).toBeNull();
  });

  it("refuses when two-factor is not on", async () => {
    await signedInAsNewUser({ password: "hash", twoFactorEnabledAt: null });

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "correct" }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });
});
