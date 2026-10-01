import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateToken,
  hashToken,
  tokenExpiry,
} from "@/lib/auth/tokens";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import type { UserId } from "@/lib/ids";
import { maybePruneExpiredAuthRows } from "@/server/auth/service";

// One row per user at a time: issuing a new link retires any earlier one, so a
// stale link in an old email cannot still move the account later.
export async function replaceVerificationToken(
  userId: UserId,
  newEmail: string | null,
): Promise<string> {
  await maybePruneExpiredAuthRows();

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      newEmail,
      tokenHash: hashToken(token),
      expiresAt: tokenExpiry(EMAIL_VERIFICATION_TTL_MS),
    },
  });

  return token;
}

export async function findEmailVerificationState(userId: UserId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
}

export async function findUserIdByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
}

export async function findEmailVerificationToken(tokenHash: string) {
  return prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true } } },
  });
}

interface RedeemableEmailToken {
  id: string;
  userId: UserId;
  newEmail: string | null;
}

/**
 * Confirms the address (or moves the account to the new one) and consumes the
 * token, in one transaction. Returns the error code to report, or null.
 */
export async function redeemEmailVerificationToken(
  record: RedeemableEmailToken,
  now: Date,
): Promise<AuthErrorCode | null> {
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          // Null newEmail means "just confirm what is already here".
          ...(record.newEmail ? { email: record.newEmail } : {}),
          emailVerified: now,
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
    ]);
  } catch (error) {
    // The target address was claimed between request and confirmation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return AUTH_ERROR.emailTaken;
    }
    return AUTH_ERROR.generic;
  }

  return null;
}
