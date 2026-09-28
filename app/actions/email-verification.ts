"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { maybePruneExpiredAuthRows } from "@/lib/auth/cleanup";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateToken,
  hashToken,
  tokenExpiry,
} from "@/lib/auth/tokens";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import {
  renderEmailChangeEmail,
  renderEmailChangedNoticeEmail,
  renderVerifyEmailAddressEmail,
} from "@/lib/email/templates/auth-emails";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_ERROR, type AuthErrorCode, changeEmailSchema } from "@/lib/validations/auth";
import { requiredString } from "@/lib/validations/form-data";

interface EmailVerificationResult {
  success: boolean;
  error?: AuthErrorCode;
}

// One row per user at a time: issuing a new link retires any earlier one, so a
// stale link in an old email cannot still move the account later.
async function replaceVerificationToken(userId: string, newEmail: string | null): Promise<string> {
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

/**
 * Sends a link confirming the address already on the account.
 *
 * Accounts created through the no-email fallback have `emailVerified` null and
 * no other way to become verified; this is that way.
 */
export async function requestEmailVerification(): Promise<EmailVerificationResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const budget = await consumeRateLimit(
    `verify-email:user:${user.id}`,
    RATE_LIMITS.emailVerificationPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerified: true },
  });

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (record.emailVerified) {
    return { success: false, error: AUTH_ERROR.alreadyVerified };
  }

  const token = await replaceVerificationToken(user.id, null);
  const locale = await getLocale();
  const { subject, html, text } = renderVerifyEmailAddressEmail(
    locale,
    `${appUrl}/confirm-email?token=${encodeURIComponent(token)}`,
  );

  await sendEmail({ to: record.email, subject, html, text });

  return { success: true };
}

/**
 * Starts an email change. The link goes to the NEW address, so the change only
 * completes if the requester can read mail there.
 *
 * The current password is required as well: a hijacked session would otherwise
 * be enough to move the account to an attacker's inbox and lock the owner out
 * permanently. Password plus control of the target mailbox is a much higher
 * bar than either alone.
 */
export async function requestEmailChange(formData: FormData): Promise<EmailVerificationResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const budget = await consumeRateLimit(
    `change-email:user:${user.id}`,
    RATE_LIMITS.emailVerificationPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = changeEmailSchema.safeParse({
    email: requiredString(formData.get("email")),
    currentPassword: requiredString(formData.get("currentPassword")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { email: newEmail, currentPassword } = parsed.data;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, password: true },
  });

  if (!record?.password) {
    // OAuth-only accounts have no password to check, so this flow does not
    // apply to them — their address is owned by the provider.
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (!(await verifyPassword(currentPassword, record.password))) {
    return { success: false, error: AUTH_ERROR.currentPasswordIncorrect };
  }

  if (newEmail === record.email) {
    return { success: false, error: AUTH_ERROR.sameEmail };
  }

  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });

  // A taken target address returns the same success as a free one and simply
  // sends nothing. The alternative would let a signed-in user probe addresses;
  // this caps that at the 6/hour rate limit and reveals nothing per attempt.
  // The unique index is still the real guard at redemption time.
  if (!existing) {
    const token = await replaceVerificationToken(user.id, newEmail);
    const locale = await getLocale();
    const { subject, html, text } = renderEmailChangeEmail(
      locale,
      `${appUrl}/confirm-email?token=${encodeURIComponent(token)}`,
    );

    await sendEmail({ to: newEmail, subject, html, text });
  }

  return { success: true };
}

/**
 * Redeems a verification or email-change link.
 *
 * A POST, like signup confirmation, because mail scanners follow every link in
 * an inbox and would otherwise consume the token before the user sees it.
 */
export async function confirmEmail(formData: FormData): Promise<EmailVerificationResult> {
  const ip = await getClientIp();
  const budget = await consumeRateLimit(`confirm-email:ip:${ip}`, RATE_LIMITS.resetRedeemPerIp);

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const token = formData.get("token");

  if (typeof token !== "string" || token.length === 0) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });

  // Missing, expired and already-used collapse to one error.
  if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  const previousEmail = record.user.email;
  const now = new Date();

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
      return { success: false, error: AUTH_ERROR.emailTaken };
    }
    return { success: false, error: AUTH_ERROR.generic };
  }

  // Tell the old address that the account moved, so its owner can react if the
  // change was not theirs. Best effort — the change already succeeded.
  if (record.newEmail) {
    const locale = await getLocale();
    await sendEmail({
      to: previousEmail,
      ...renderEmailChangedNoticeEmail(locale),
    });
  }

  return { success: true };
}
