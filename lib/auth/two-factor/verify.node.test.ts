import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

// `vi.mock` factories are hoisted above ordinary top-level declarations, so the
// key has to be created inside `vi.hoisted` to exist by the time the factory
// runs. Fixed rather than random: nothing here benefits from varying it, and a
// deterministic key makes a failure reproducible.
const { KEY } = vi.hoisted(() => ({
  KEY: Buffer.alloc(32, 7).toString("base64"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
    twoFactorRecoveryCode: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/env", () => ({ env: { TWO_FACTOR_ENCRYPTION_KEY: KEY } }));

import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "./encryption";
import { hashRecoveryCode } from "./recovery-codes";
import { deriveCode, generateTotpSecret, stepForTime } from "./totp";
import { verifyAndConsumeTwoFactor } from "./verify";

const SECRET = generateTotpSecret();
const ENCRYPTED = encryptSecret(SECRET, KEY);
const RECOVERY_CODE = "ABCDE-FGHJK-MNPQR";

function user(overrides: Partial<Parameters<typeof verifyAndConsumeTwoFactor>[0]> = {}) {
  return {
    id: "user-1",
    twoFactorSecret: ENCRYPTED,
    twoFactorLastStep: null,
    ...overrides,
  };
}

// Frozen: the code is derived from the clock and the assertions recompute the
// step from it, so a run that straddled a 30-second boundary would compare two
// different steps and fail for no reason.
const NOW = 1_800_000_000_000;
const CURRENT_STEP = stepForTime(NOW);
const currentCode = () => deriveCode(SECRET, CURRENT_STEP);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockReset();
  vi.mocked(prisma.twoFactorRecoveryCode.updateMany).mockReset();
  vi.mocked(prisma.twoFactorRecoveryCode.updateMany).mockResolvedValue({
    count: 1,
  } as never);
});

describe("verifyAndConsumeTwoFactor with a TOTP code", () => {
  it("accepts a current code and records the step", async () => {
    const result = await verifyAndConsumeTwoFactor(user(), currentCode());

    expect(result).toEqual({ valid: true, method: "totp" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorLastStep: CURRENT_STEP },
    });
  });

  it("rejects a wrong code", async () => {
    expect(await verifyAndConsumeTwoFactor(user(), "000000")).toEqual({
      valid: false,
      method: null,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses to replay a code whose step was already used", async () => {
    const step = CURRENT_STEP;

    // The code is still mathematically valid for the rest of its 30s window;
    // this is what stops someone reusing one they saw over a shoulder.
    const result = await verifyAndConsumeTwoFactor(
      user({ twoFactorLastStep: step }),
      deriveCode(SECRET, step),
    );

    expect(result).toEqual({ valid: false, method: null });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a code from a step older than the last one used", async () => {
    const step = CURRENT_STEP;

    expect(
      await verifyAndConsumeTwoFactor(
        user({ twoFactorLastStep: step }),
        deriveCode(SECRET, step - 1),
      ),
    ).toEqual({ valid: false, method: null });
  });

  it("AUTH-8: accepts the next step after one has been consumed", async () => {
    const step = CURRENT_STEP;

    // Drift tolerance still works going forward; only backwards is blocked.
    expect(
      await verifyAndConsumeTwoFactor(
        user({ twoFactorLastStep: step - 1 }),
        deriveCode(SECRET, step),
      ),
    ).toEqual({ valid: true, method: "totp" });
  });
});

describe("verifyAndConsumeTwoFactor with a recovery code", () => {
  it("AUTH-10: accepts an unused code belonging to the user and burns it", async () => {
    vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockResolvedValue({
      id: "rc-1",
      userId: "user-1",
      usedAt: null,
    } as never);

    const result = await verifyAndConsumeTwoFactor(user(), RECOVERY_CODE);

    expect(result).toEqual({ valid: true, method: "recoveryCode" });
    expect(prisma.twoFactorRecoveryCode.updateMany).toHaveBeenCalledWith({
      // Guarded on usedAt so two requests racing the same code cannot both win.
      where: { id: "rc-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("looks the code up by digest, never by the code itself", async () => {
    vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockResolvedValue(null);

    await verifyAndConsumeTwoFactor(user(), RECOVERY_CODE);

    expect(prisma.twoFactorRecoveryCode.findUnique).toHaveBeenCalledWith({
      where: { codeHash: hashRecoveryCode(RECOVERY_CODE) },
    });
  });

  it("rejects a code already used", async () => {
    vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockResolvedValue({
      id: "rc-1",
      userId: "user-1",
      usedAt: new Date(),
    } as never);

    expect(await verifyAndConsumeTwoFactor(user(), RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
  });

  it("rejects a valid code belonging to somebody else", async () => {
    vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockResolvedValue({
      id: "rc-1",
      userId: "someone-else",
      usedAt: null,
    } as never);

    expect(await verifyAndConsumeTwoFactor(user(), RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
    expect(prisma.twoFactorRecoveryCode.updateMany).not.toHaveBeenCalled();
  });

  it("loses the race when another request consumed it first", async () => {
    vi.mocked(prisma.twoFactorRecoveryCode.findUnique).mockResolvedValue({
      id: "rc-1",
      userId: "user-1",
      usedAt: null,
    } as never);
    vi.mocked(prisma.twoFactorRecoveryCode.updateMany).mockResolvedValue({
      count: 0,
    } as never);

    expect(await verifyAndConsumeTwoFactor(user(), RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
  });
});

describe("verifyAndConsumeTwoFactor edge cases", () => {
  it("rejects an empty submission without touching the database", async () => {
    expect(await verifyAndConsumeTwoFactor(user(), "   ")).toEqual({
      valid: false,
      method: null,
    });
    expect(prisma.twoFactorRecoveryCode.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the account has no secret", async () => {
    expect(await verifyAndConsumeTwoFactor(user({ twoFactorSecret: null }), currentCode())).toEqual(
      { valid: false, method: null },
    );
  });

  it("rejects rather than throwing when the secret cannot be decrypted", async () => {
    // Wrong key or a tampered row. Feeding garbage into an HMAC and comparing
    // the result would be the alternative.
    const encryptedElsewhere = encryptSecret(SECRET, randomBytes(32).toString("base64"));

    expect(
      await verifyAndConsumeTwoFactor(user({ twoFactorSecret: encryptedElsewhere }), currentCode()),
    ).toEqual({ valid: false, method: null });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
