import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { decryptSecret } from "./encryption";
import { hashRecoveryCode } from "./recovery-codes";
import { verifyTotp } from "./totp";

// Shared by the login path and by the account actions, so the rules about
// replay and single-use recovery codes cannot drift between them.

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
