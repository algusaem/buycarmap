"use server";

import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { hashToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordChangedEmail } from "@/lib/email/templates/auth-emails";
import { requiredString } from "@/lib/form-data";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { logger } from "@/lib/logger";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { asUserId } from "@/lib/ids";
import { forgotPasswordSchema } from "@/server/auth/schema";
import { loginEmailRateKey } from "@/server/auth/service";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
  resetRateLimit,
} from "@/server/rate-limit/service";
import { resetPasswordSchema } from "./schema";
import {
  completePasswordReset,
  findPasswordResetToken,
  findResetCandidate,
  issueResetToken,
} from "./service";

interface PasswordResetResult {
  success: boolean;
  error?: AuthErrorCode;
}

export async function requestPasswordReset(formData: FormData): Promise<PasswordResetResult> {
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
  const ipBudget = await consumeRateLimit(`reset-request:ip:${ip}`, RATE_LIMITS.resetRequestPerIp);
  const emailBudget = await consumeRateLimit(
    `reset-request:email:${email}`,
    RATE_LIMITS.resetRequestPerEmail,
  );

  if (!ipBudget.allowed || !emailBudget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const user = await findResetCandidate(email);

  // Only credential accounts can reset a password; an OAuth-only account has
  // none to reset. Both cases fall through to the same generic success.
  if (user?.password) {
    try {
      await issueResetToken(asUserId(user.id), email);
    } catch (error) {
      // Swallowed on purpose. Surfacing this would make "did an error occur?"
      // a signal for whether the account exists — the one thing this whole
      // action is built to hide.
      logger.error({ err: error }, "Failed to issue password reset token");
    }
  }

  // Always the same answer, whether the address is unknown, OAuth-only, or a
  // real credential account. The UI copy is already worded neutrally
  // ("if an account matches that email…").
  return { success: true };
}

export async function resetPassword(formData: FormData): Promise<PasswordResetResult> {
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
  const record = await findPasswordResetToken(hashToken(token));

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

  await completePasswordReset(
    { id: record.id, userId: asUserId(record.userId) },
    hashedPassword,
    now,
  );

  // The user just proved control of the mailbox, so a lockout from the failed
  // attempts that led here should not survive the reset.
  await resetRateLimit(loginEmailRateKey(record.user.email));

  const locale = await getCurrentLocale();
  const notice = renderPasswordChangedEmail(locale);
  await sendEmail({ to: record.user.email, ...notice });

  return { success: true };
}
