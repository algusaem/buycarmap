"use server";

import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { hashToken } from "@/lib/auth/tokens";
import { loginEmailRateKey } from "@/lib/auth/authorize";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordChangedEmail } from "@/lib/email/templates/auth-emails";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS, consumeRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";
import { AUTH_ERROR, type AuthErrorCode, resetPasswordSchema } from "@/lib/validations/auth";
import { requiredString } from "@/lib/validations/form-data";

interface ResetPasswordResult {
  success: boolean;
  error?: AuthErrorCode;
}

export async function resetPassword(formData: FormData): Promise<ResetPasswordResult> {
  const ip = await getClientIp();
  const budget = await consumeRateLimit(`reset-redeem:ip:${ip}`, RATE_LIMITS.resetRedeemPerIp);

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = resetPasswordSchema.safeParse({
    token: requiredString(formData.get("token")),
    password: requiredString(formData.get("password")),
    confirmPassword: requiredString(formData.get("confirmPassword")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { token, password } = parsed.data;

  // Look up by digest: the raw token is never stored, so this is the only way
  // to find the record — and an indexed equality match on a 256-bit random
  // value has no timing signal worth defending against.
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, password: true } } },
  });

  // Expired, already redeemed, and never-existed all collapse to one error, so
  // a probe cannot tell a real-but-stale token from a fabricated one.
  if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  const passwordError = await validateNewPassword(password, [record.user.email]);

  if (passwordError) {
    return { success: false, error: passwordError };
  }

  // Reusing the current password would leave the account exactly as exposed as
  // whatever prompted the reset.
  if (record.user.password && (await verifyPassword(password, record.user.password))) {
    return { success: false, error: AUTH_ERROR.passwordReused };
  }

  const hashedPassword = await hashPassword(password);
  const now = new Date();

  // One transaction so a token can never be consumed without the password
  // actually changing, or vice versa.
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

  // The user just proved control of the mailbox, so a lockout from the failed
  // attempts that led here should not survive the reset.
  await resetRateLimit(loginEmailRateKey(record.user.email));

  const locale = await getLocale();
  const notice = renderPasswordChangedEmail(locale);
  await sendEmail({ to: record.user.email, ...notice });

  return { success: true };
}
