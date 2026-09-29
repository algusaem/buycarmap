import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/auth/two-factor/encryption";
import { hashRecoveryCode } from "@/lib/auth/two-factor/recovery-codes";
import { verifyTotp } from "@/lib/auth/two-factor/totp";

// verifyAndConsumeTwoFactor is shared by the login path and by the account
// actions, so the rules about replay and single-use recovery codes cannot
// drift between them. Other features reach it through server/auth/service.ts.

type TwoFactorMethod = "totp" | "recoveryCode";

export interface TwoFactorCheck {
  valid: boolean;
  method: TwoFactorMethod | null;
}

interface TwoFactorUser {
  id: string;
  twoFactorSecret: string | null;
  twoFactorLastStep: number | null;
}

/**
 * Checks a submitted code and, on success, consumes it.
 *
 * "Consumes" is the important part and is why this touches the database rather
 * than being a pure function: a TOTP code stays mathematically valid for its
 * whole window, and a recovery code forever, so both have to be burned at the
 * moment they are accepted.
 */
export async function verifyAndConsumeTwoFactor(
  user: TwoFactorUser,
  submitted: string,
): Promise<TwoFactorCheck> {
  const code = submitted.trim();

  if (!code || !user.twoFactorSecret || !env.TWO_FACTOR_ENCRYPTION_KEY) {
    return { valid: false, method: null };
  }

  let secret: string;

  try {
    secret = decryptSecret(user.twoFactorSecret, env.TWO_FACTOR_ENCRYPTION_KEY);
  } catch {
    // Wrong key or a tampered row. Refusing is the only safe answer — the
    // alternative is feeding garbage into an HMAC and comparing the result.
    console.error(`[auth] Could not decrypt the two-factor secret for user ${user.id}`);
    return { valid: false, method: null };
  }

  const totp = verifyTotp(secret, code);

  if (totp.valid && totp.step !== null) {
    // Replay guard: a code observed over someone's shoulder is refused once
    // its own step has been used, rather than staying good for the remainder
    // of the window.
    if (user.twoFactorLastStep !== null && totp.step <= user.twoFactorLastStep) {
      return { valid: false, method: null };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorLastStep: totp.step },
    });

    return { valid: true, method: "totp" };
  }

  // Not a valid TOTP code — it may still be a recovery code. Looked up by
  // digest, so an indexed equality match rather than ten comparisons.
  const recovery = await prisma.twoFactorRecoveryCode.findUnique({
    where: { codeHash: hashRecoveryCode(code) },
  });

  if (!recovery || recovery.userId !== user.id || recovery.usedAt !== null) {
    return { valid: false, method: null };
  }

  // `updateMany` with a usedAt guard rather than `update`: two requests racing
  // the same code both pass the check above, and only one may win.
  const consumed = await prisma.twoFactorRecoveryCode.updateMany({
    where: { id: recovery.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (consumed.count === 0) {
    return { valid: false, method: null };
  }

  return { valid: true, method: "recoveryCode" };
}

/** What enrolment needs to know before minting a secret. */
export async function findTwoFactorSetupState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, password: true, twoFactorEnabledAt: true },
  });
}

/** Stores a freshly minted, already encrypted secret and clears the replay step. */
export async function storePendingTwoFactorSecret(
  userId: string,
  encryptedSecret: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encryptedSecret,
      twoFactorLastStep: null,
    },
  });
}

/** What confirming enrolment needs: the pending secret and whether 2FA is already on. */
export async function findTwoFactorConfirmState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true },
  });
}

/** Switches 2FA on and replaces the recovery codes, in one transaction. */
export async function enableTwoFactor(
  userId: string,
  enabledAt: Date,
  lastStep: number,
  recoveryCodeHashes: string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabledAt: enabledAt, twoFactorLastStep: lastStep },
    }),
    // Any codes from a previous enrolment are gone; only this set works.
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodeHashes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);
}

/** What turning 2FA off needs: the password hash and the current 2FA state. */
export async function findTwoFactorDisableState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      twoFactorSecret: true,
      twoFactorEnabledAt: true,
      twoFactorLastStep: true,
    },
  });
}

/** Clears the secret and every recovery code, in one transaction. */
export async function disableTwoFactorForUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorLastStep: null,
      },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
  ]);
}

/** What regenerating recovery codes needs: the password hash and whether 2FA is on. */
export async function findRecoveryCodesState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabledAt: true },
  });
}

/** Replaces every recovery code with a fresh set, in one transaction. */
export async function replaceRecoveryCodes(
  userId: string,
  recoveryCodeHashes: string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodeHashes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);
}
