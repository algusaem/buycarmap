import { prisma } from "@/lib/db/prisma";
import { PASSWORD_RESET_TTL_MS, generateToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordResetEmail } from "@/lib/email/templates/auth-emails";
import { appUrl } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { maybePruneExpiredAuthRows } from "@/server/auth/service";

export async function findResetCandidate(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });
}

// Mints a token and emails the link. Split out so the caller's control flow
// stays identical whether or not an account was found.
export async function issueResetToken(userId: string, email: string): Promise<void> {
  // Opportunistic housekeeping, on a path that already writes a token row.
  await maybePruneExpiredAuthRows();

  // Invalidate outstanding tokens first: without this, every request adds
  // another simultaneously-valid link, widening the window in which a leaked
  // email grants access.
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();

  await prisma.passwordResetToken.create({
    data: {
      userId,
      // Only the digest is stored — the raw token lives solely in the email.
      tokenHash: hashToken(token),
      expiresAt: tokenExpiry(PASSWORD_RESET_TTL_MS),
    },
  });

  const locale = await getLocale();
  const { subject, html, text } = renderPasswordResetEmail(
    locale,
    `${appUrl}/reset-password?token=${encodeURIComponent(token)}`,
  );

  await sendEmail({ to: email, subject, html, text });
}

export async function findPasswordResetToken(tokenHash: string) {
  return prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, password: true } } },
  });
}

interface RedeemableResetToken {
  id: string;
  userId: string;
}

/**
 * Sets the new password and consumes the token. One transaction so a token can
 * never be consumed without the password actually changing, or vice versa.
 */
export async function completePasswordReset(
  record: RedeemableResetToken,
  hashedPassword: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        password: hashedPassword,
        // Bumping this invalidates every JWT issued before now — the reset is
        // pointless if whoever prompted it keeps a live session.
        passwordChangedAt: now,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    // Any other outstanding tokens are now stale.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    }),
    // Adapter-backed sessions, if OAuth is enabled.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
