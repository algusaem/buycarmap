import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";

const { KEY } = vi.hoisted(() => ({
  KEY: Buffer.alloc(32, 7).toString("base64"),
}));

vi.mock("@/lib/env", () => ({ env: { TWO_FACTOR_ENCRYPTION_KEY: KEY } }));

import { encryptSecret } from "@/lib/auth/two-factor/encryption";
import { hashRecoveryCode } from "@/lib/auth/two-factor/recovery-codes";
import { deriveCode, generateTotpSecret, stepForTime } from "@/lib/auth/two-factor/totp";
import { verifyAndConsumeTwoFactor } from "./service";

const SECRET = generateTotpSecret();
const ENCRYPTED = encryptSecret(SECRET, KEY);
const RECOVERY_CODE = "ABCDE-FGHJK-MNPQR";

// Frozen: the code is derived from the clock and the assertions recompute the
// step from it, so a run that straddled a 30-second boundary would compare two
// different steps and fail for no reason.
const NOW = 1_800_000_000_000;
const CURRENT_STEP = stepForTime(NOW);
const currentCode = () => deriveCode(SECRET, CURRENT_STEP);

async function seedTwoFactorUser(overrides: { twoFactorLastStep?: number | null } = {}) {
  return createUser({
    twoFactorSecret: ENCRYPTED,
    twoFactorLastStep: overrides.twoFactorLastStep ?? null,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyAndConsumeTwoFactor with a TOTP code", () => {
  it("accepts a current code and records the step", async () => {
    const user = await seedTwoFactorUser();

    const result = await verifyAndConsumeTwoFactor(user, currentCode());

    expect(result).toEqual({ valid: true, method: "totp" });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorLastStep).toBe(CURRENT_STEP);
  });

  it("rejects a wrong code", async () => {
    const user = await seedTwoFactorUser();

    expect(await verifyAndConsumeTwoFactor(user, "000000")).toEqual({
      valid: false,
      method: null,
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorLastStep).toBeNull();
  });

  it("refuses to replay a code whose step was already used", async () => {
    const step = CURRENT_STEP;
    const user = await seedTwoFactorUser({ twoFactorLastStep: step });

    // The code is still mathematically valid for the rest of its 30s window;
    // this is what stops someone reusing one they saw over a shoulder.
    const result = await verifyAndConsumeTwoFactor(user, deriveCode(SECRET, step));

    expect(result).toEqual({ valid: false, method: null });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorLastStep).toBe(step);
  });

  it("AUTH-8: accepts the next step after one has been consumed", async () => {
    const step = CURRENT_STEP;
    const user = await seedTwoFactorUser({ twoFactorLastStep: step - 1 });

    // Drift tolerance still works going forward; only backwards is blocked.
    const result = await verifyAndConsumeTwoFactor(user, deriveCode(SECRET, step));

    expect(result).toEqual({ valid: true, method: "totp" });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.twoFactorLastStep).toBe(step);
  });
});

describe("verifyAndConsumeTwoFactor with a recovery code", () => {
  it("AUTH-10: accepts an unused code belonging to the user and burns it", async () => {
    const user = await seedTwoFactorUser();
    const recoveryCode = await prisma.twoFactorRecoveryCode.create({
      data: { user: { connect: { id: user.id } }, codeHash: hashRecoveryCode(RECOVERY_CODE) },
    });

    const result = await verifyAndConsumeTwoFactor(user, RECOVERY_CODE);

    expect(result).toEqual({ valid: true, method: "recoveryCode" });
    const found = await prisma.twoFactorRecoveryCode.findUnique({ where: { id: recoveryCode.id } });
    expect(found?.usedAt).not.toBeNull();
  });

  it("looks the code up by digest, never by the code itself", async () => {
    const user = await seedTwoFactorUser();
    const spy = vi.spyOn(prisma.twoFactorRecoveryCode, "findUnique");

    await verifyAndConsumeTwoFactor(user, RECOVERY_CODE);

    expect(spy).toHaveBeenCalledWith({ where: { codeHash: hashRecoveryCode(RECOVERY_CODE) } });
    spy.mockRestore();
  });

  it("rejects a code already used", async () => {
    const user = await seedTwoFactorUser();
    await prisma.twoFactorRecoveryCode.create({
      data: {
        user: { connect: { id: user.id } },
        codeHash: hashRecoveryCode(RECOVERY_CODE),
        usedAt: new Date(),
      },
    });

    expect(await verifyAndConsumeTwoFactor(user, RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
  });

  it("rejects a valid code belonging to somebody else", async () => {
    const user = await seedTwoFactorUser();
    const someoneElse = await seedTwoFactorUser();
    const recoveryCode = await prisma.twoFactorRecoveryCode.create({
      data: {
        user: { connect: { id: someoneElse.id } },
        codeHash: hashRecoveryCode(RECOVERY_CODE),
      },
    });

    expect(await verifyAndConsumeTwoFactor(user, RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
    const found = await prisma.twoFactorRecoveryCode.findUnique({ where: { id: recoveryCode.id } });
    expect(found?.usedAt).toBeNull();
  });

  it("loses the race when another request consumed it first", async () => {
    const user = await seedTwoFactorUser();
    await prisma.twoFactorRecoveryCode.create({
      data: {
        user: { connect: { id: user.id } },
        codeHash: hashRecoveryCode(RECOVERY_CODE),
        // Already used, simulating another request winning the race.
        usedAt: new Date(),
      },
    });

    expect(await verifyAndConsumeTwoFactor(user, RECOVERY_CODE)).toEqual({
      valid: false,
      method: null,
    });
  });
});

describe("verifyAndConsumeTwoFactor edge cases", () => {
  it("rejects an empty submission without touching the database", async () => {
    const user = await seedTwoFactorUser();
    const spy = vi.spyOn(prisma.twoFactorRecoveryCode, "findUnique");

    expect(await verifyAndConsumeTwoFactor(user, "   ")).toEqual({
      valid: false,
      method: null,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
