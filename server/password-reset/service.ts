import { createElement } from "react";
import { prisma } from "@/lib/db/prisma";
import { PASSWORD_RESET_TTL_MS, generateToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/platform/email";
import { PasswordResetEmail, subject as passwordResetSubject } from "@/emails/PasswordResetEmail";
import { renderEmail } from "@/emails/render";
import { appUrl } from "@/lib/app-config";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import type { UserId } from "@/lib/ids";
import { maybePruneExpiredAuthRows } from "@/server/auth/service";

// BAUTH-19 (docs/specs/core-better-auth.md): the password is the "credential"
// `accounts` row's, never the legacy `users.password` column.
const CREDENTIAL_PASSWORD = {
  where: { provider: "credential" },
  select: { password: true },
  take: 1,
} as const;

export async function findResetCandidate(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, accounts: CREDENTIAL_PASSWORD },
  });
  if (!user) return null;
  return { id: user.id, password: user.accounts[0]?.password ?? null };
}

// Mints a token and emails the link. Split out so the caller's control flow
// stays identical whether or not an account was found.
export async function issueResetToken(userId: UserId, email: string): Promise<void> {
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

  const locale = await getCurrentLocale();
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const props = { locale, resetUrl };
  const { html, text } = await renderEmail(createElement(PasswordResetEmail, props));

  await sendEmail({ to: email, subject: passwordResetSubject(locale, props), html, text });
}

export async function findPasswordResetToken(tokenHash: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, accounts: CREDENTIAL_PASSWORD } } },
  });
  if (!record) return null;
  const { accounts, ...user } = record.user;
  return { ...record, user: { ...user, password: accounts[0]?.password ?? null } };
}

interface RedeemableResetToken {
  id: string;
  userId: UserId;
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
      // No signed-in actor during a password reset, so updatedById stays
      // null (DATA-9) — only the version counter moves.
      data: { version: { increment: 1 } },
    }),
    // BAUTH-19: the credential account is the only place the password lives;
    // Better Auth's sign-in reads it there.
    prisma.account.updateMany({
      where: { userId: record.userId, provider: "credential" },
      data: { password: hashedPassword },
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
    // Every session ends: the reset is pointless if whoever prompted it
    // keeps a live session.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
