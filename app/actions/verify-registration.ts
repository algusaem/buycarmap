"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/validations/auth";

interface VerifyRegistrationResult {
  success: boolean;
  error?: AuthErrorCode;
  /** Returned on success so the confirmation page can prefill the sign-in link. */
  email?: string;
}

/**
 * Redeems a signup confirmation link and creates the account.
 *
 * This is the only place a credential `User` row is created once email is
 * configured. Requiring a POST (a button on /verify-email, not the link click
 * itself) matters: corporate mail scanners follow every link in an inbox, and
 * a GET that creates accounts would let a scanner consume the token before the
 * recipient ever sees the page.
 */
export async function verifyRegistration(formData: FormData): Promise<VerifyRegistrationResult> {
  const ip = await getClientIp();
  const budget = await consumeRateLimit(
    `verify-registration:ip:${ip}`,
    RATE_LIMITS.resetRedeemPerIp,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const token = formData.get("token");

  if (typeof token !== "string" || token.length === 0) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  // Looked up by digest: the raw token is never stored.
  const pending = await prisma.pendingRegistration.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  // Missing and expired collapse to one error, so a probe cannot tell a real
  // but stale token from a fabricated one.
  if (!pending || pending.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  try {
    await prisma.user.create({
      data: {
        email: pending.email,
        // Already bcrypt-hashed at submit time, so confirmation never has to
        // ask for the password again.
        password: pending.password,
        name: pending.name,
        // Redeeming this link *is* the proof of address ownership.
        emailVerified: new Date(),
      },
    });
  } catch (error) {
    // The address was claimed between submit and confirmation — either by a
    // race, or because this link belongs to an attempt on an address that
    // already had an account. Either way the account exists and the holder of
    // this mailbox can sign in, so treat it as done rather than as an error.
    const isDuplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isDuplicate) {
      return { success: false, error: AUTH_ERROR.generic };
    }
  }

  // Consume this token and any sibling attempts on the same address.
  await prisma.pendingRegistration.deleteMany({
    where: { email: pending.email },
  });

  return { success: true, email: pending.email };
}
