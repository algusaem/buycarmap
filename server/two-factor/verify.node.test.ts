import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./verify.integration.test.ts. These four never touch Prisma at all — the
// step-ordering and no-secret/can't-decrypt branches return before any
// database call — so this file no longer mocks @/lib/db/prisma.

const { KEY } = vi.hoisted(() => ({
  KEY: Buffer.alloc(32, 7).toString("base64"),
}));

vi.mock("@/lib/env", () => ({ env: { TWO_FACTOR_ENCRYPTION_KEY: KEY } }));

import { encryptSecret } from "@/lib/auth/two-factor/encryption";
import { deriveCode, generateTotpSecret, stepForTime } from "@/lib/auth/two-factor/totp";
import { verifyAndConsumeTwoFactor } from "./service";

const SECRET = generateTotpSecret();
const ENCRYPTED = encryptSecret(SECRET, KEY);

function user(overrides: Partial<Parameters<typeof verifyAndConsumeTwoFactor>[0]> = {}) {
  return {
    id: "user-1",
    twoFactorSecret: ENCRYPTED,
    twoFactorLastStep: null,
    ...overrides,
  };
}

const NOW = 1_800_000_000_000;
const CURRENT_STEP = stepForTime(NOW);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyAndConsumeTwoFactor with a TOTP code", () => {
  it("refuses a code from a step older than the last one used", async () => {
    const step = CURRENT_STEP;

    // Rejected before any write — a matching but stale step never reaches
    // prisma.user.update, which is what keeps this test free of the database.
    expect(
      await verifyAndConsumeTwoFactor(
        user({ twoFactorLastStep: step }),
        deriveCode(SECRET, step - 1),
      ),
    ).toEqual({ valid: false, method: null });
  });
});

describe("verifyAndConsumeTwoFactor edge cases", () => {
  it("rejects when the account has no secret", async () => {
    expect(
      await verifyAndConsumeTwoFactor(
        user({ twoFactorSecret: null }),
        deriveCode(SECRET, CURRENT_STEP),
      ),
    ).toEqual({ valid: false, method: null });
  });

  it("rejects rather than throwing when the secret cannot be decrypted", async () => {
    // Wrong key or a tampered row. Feeding garbage into an HMAC and comparing
    // the result would be the alternative.
    const encryptedElsewhere = encryptSecret(SECRET, randomBytes(32).toString("base64"));

    expect(
      await verifyAndConsumeTwoFactor(
        user({ twoFactorSecret: encryptedElsewhere }),
        deriveCode(SECRET, CURRENT_STEP),
      ),
    ).toEqual({ valid: false, method: null });
  });
});
