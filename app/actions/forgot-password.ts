"use server";

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordResetEmail } from "@/lib/email/templates/auth-emails";
import {
  PASSWORD_RESET_TTL_MS,
  generateToken,
  hashToken,
  tokenExpiry,
} from "@/lib/auth/tokens";
import { getLocale } from "@/lib/i18n/server";
import { maybePruneExpiredAuthRows } from "@/lib/auth/cleanup";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import {
  AUTH_ERROR,
  type AuthErrorCode,
  forgotPasswordSchema,
} from "@/lib/validations/auth";
import { requiredString } from "@/lib/validations/form-data";

interface ForgotPasswordResult {
  success: boolean;
  error?: AuthErrorCode;
}

// Mints a token and emails the link. Split out so the caller's control flow
// stays identical whether or not an account was found.
async function issueResetToken(userId: string, email: string): Promise<void> {
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

export async function requestPasswordReset(
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: requiredString(formData.get("email")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { email } = parsed.data;
  const ip = await getClientIp();

  // Two limits with different jobs: the per-IP one stops a script from farming
  // reset emails, the per-email one stops anyone from using us to flood a
  // specific person's inbox.
  const ipBudget = await consumeRateLimit(
    `reset-request:ip:${ip}`,
    RATE_LIMITS.resetRequestPerIp,
  );
  const emailBudget = await consumeRateLimit(
    `reset-request:email:${email}`,
    RATE_LIMITS.resetRequestPerEmail,
  );

  if (!ipBudget.allowed || !emailBudget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });

  // Only credential accounts can reset a password; an OAuth-only account has
  // none to reset. Both cases fall through to the same generic success.
  if (user?.password) {
    try {
      await issueResetToken(user.id, email);
    } catch (error) {
      // Swallowed on purpose. Surfacing this would make "did an error occur?"
      // a signal for whether the account exists — the one thing this whole
      // action is built to hide.
      console.error("[auth] Failed to issue password reset token", error);
    }
  }

  // Always the same answer, whether the address is unknown, OAuth-only, or a
  // real credential account. The UI copy is already worded neutrally
  // ("if an account matches that email…").
  return { success: true };
}
