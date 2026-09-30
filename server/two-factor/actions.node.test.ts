import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { KEY } = vi.hoisted(() => ({
  KEY: Buffer.alloc(32, 7).toString("base64"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    twoFactorRecoveryCode: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
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

import { prisma } from "@/lib/db/prisma";
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

const SESSION_USER = { id: "user-1", email: "ada@example.com" };
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getCurrentUser).mockResolvedValue(SESSION_USER);
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.$transaction).mockClear();
  vi.mocked(prisma.$transaction).mockResolvedValue([]);
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(verifyAndConsumeTwoFactor).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
});

describe("startTwoFactorSetup", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await startTwoFactorSetup()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses for an OAuth-only account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "oauth@example.com",
      password: null,
      twoFactorEnabledAt: null,
    } as never);

    expect(await startTwoFactorSetup()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("refuses when two-factor is already on", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      password: "hash",
      twoFactorEnabledAt: new Date(),
    } as never);

    expect(await startTwoFactorSetup()).toEqual({
      success: false,
      error: "totpAlreadyEnabled",
    });
  });

  it("stores the secret encrypted, never in the clear", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      password: "hash",
      twoFactorEnabledAt: null,
    } as never);

    const result = await startTwoFactorSetup();
    const stored = vi.mocked(prisma.user.update).mock.calls[0][0] as {
      data: { twoFactorSecret: string };
    };

    expect(result.success).toBe(true);
    expect(stored.data.twoFactorSecret).not.toBe(result.secret);
    expect(stored.data.twoFactorSecret.startsWith("v1:")).toBe(true);
    // What was persisted must decrypt back to what the user was shown.
    expect(decryptSecret(stored.data.twoFactorSecret, KEY)).toBe(result.secret);
  });

  it("leaves two-factor switched off until a code is confirmed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      password: "hash",
      twoFactorEnabledAt: null,
    } as never);

    await startTwoFactorSetup();
    const stored = vi.mocked(prisma.user.update).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    // Enabling here would lock out anyone whose authenticator never worked.
    expect(stored.data).not.toHaveProperty("twoFactorEnabledAt");
  });

  it("returns a scannable URI carrying the account email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      password: "hash",
      twoFactorEnabledAt: null,
    } as never);

    const { otpauthUri } = await startTwoFactorSetup();

    expect(otpauthUri).toContain("otpauth://totp/");
    expect(decodeURIComponent(otpauthUri as string)).toContain("ada@example.com");
  });
});

describe("confirmTwoFactorSetup", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorSecret: ENCRYPTED,
      twoFactorEnabledAt: null,
    } as never);
  });

  it("rejects a wrong code and leaves two-factor off", async () => {
    expect(await confirmTwoFactorSetup(formData({ code: "000000" }))).toEqual({
      success: false,
      error: "totpInvalid",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when setup was never started", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
    } as never);

    expect(await confirmTwoFactorSetup(formData({ code: currentCode() }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("enables two-factor and returns ten recovery codes on a valid code", async () => {
    const result = await confirmTwoFactorSetup(formData({ code: currentCode() }));

    expect(result.success).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("returns codes only in this response, never storing them readable", async () => {
    const result = await confirmTwoFactorSetup(formData({ code: currentCode() }));

    const created = vi.mocked(prisma.twoFactorRecoveryCode.createMany).mock.calls[0]?.[0] as
      | { data: { codeHash: string }[] }
      | undefined;

    for (const code of result.recoveryCodes ?? []) {
      expect(JSON.stringify(created)).not.toContain(code);
    }
  });

  it("records the confirming step so it cannot be replayed at login", async () => {
    await confirmTwoFactorSetup(formData({ code: currentCode() }));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        twoFactorEnabledAt: expect.any(Date),
        twoFactorLastStep: CURRENT_STEP,
      },
    });
  });

  it("refuses once the rate limit is spent", async () => {
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
  const enabled = {
    password: "hash",
    twoFactorSecret: ENCRYPTED,
    twoFactorEnabledAt: new Date(),
    twoFactorLastStep: null,
  };

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(enabled as never);
  });

  it("refuses when two-factor is not on", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...enabled,
      twoFactorEnabledAt: null,
    } as never);

    expect(await disableTwoFactor(formData({ currentPassword: "pw", code: "123456" }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });

  it("rejects a wrong password before looking at the code", async () => {
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
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({
      valid: false,
      method: null,
    });

    expect(
      await disableTwoFactor(formData({ currentPassword: "correct", code: "000000" })),
    ).toEqual({ success: false, error: "totpInvalid" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("clears the secret and every recovery code on success", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(verifyAndConsumeTwoFactor).mockResolvedValue({
      valid: true,
      method: "totp",
    });

    expect(
      await disableTwoFactor(formData({ currentPassword: "correct", code: "123456" })),
    ).toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorLastStep: null,
      },
    });
    expect(prisma.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("regenerateRecoveryCodes", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "hash",
      twoFactorEnabledAt: new Date(),
    } as never);
  });

  it("requires the password", async () => {
    expect(await regenerateRecoveryCodes(formData({ currentPassword: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
  });

  it("rejects a wrong password", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
  });

  it("does not demand a code, since the usual reason to be here is losing them", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await regenerateRecoveryCodes(formData({ currentPassword: "correct" }));

    expect(result.success).toBe(true);
    expect(verifyAndConsumeTwoFactor).not.toHaveBeenCalled();
  });

  it("replaces the previous set rather than adding to it", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await regenerateRecoveryCodes(formData({ currentPassword: "correct" }));

    expect(result.recoveryCodes).toHaveLength(10);
    expect(prisma.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("refuses when two-factor is not on", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: "hash",
      twoFactorEnabledAt: null,
    } as never);

    expect(await regenerateRecoveryCodes(formData({ currentPassword: "correct" }))).toEqual({
      success: false,
      error: "totpNotEnabled",
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
