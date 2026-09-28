"use server";

import { prisma } from "@/lib/prisma";
import { REGISTRATION_TTL_MS, generateToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import { renderVerifyRegistrationEmail } from "@/lib/email/templates/auth-emails";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_ERROR, type AuthErrorCode, forgotPasswordSchema } from "@/lib/validations/auth";
import { requiredString } from "@/lib/validations/form-data";

interface ResendConfirmationResult {
  success: boolean;
  error?: AuthErrorCode;
}

/**
 * Re-issues a signup confirmation link.
 *
 * Without this, a user whose email was delayed, filtered or deleted had no way
 * forward except registering again — which works, but reads like an error.
 *
 * The password is not re-collected: the pending row already holds the bcrypt
 * hash from the original submission, so this only mints a fresh token.
 *
 * Enumeration-neutral in the same way as `register` — the response is identical
 * whether a pending signup exists, the address already has an account, or the
 * address is entirely unknown.
 */
export async function resendConfirmation(formData: FormData): Promise<ResendConfirmationResult> {
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

  const ipBudget = await consumeRateLimit(
    `resend-confirmation:ip:${ip}`,
    RATE_LIMITS.resetRequestPerIp,
  );
  const emailBudget = await consumeRateLimit(
    `resend-confirmation:email:${email}`,
    RATE_LIMITS.resendConfirmationPerEmail,
  );

  if (!ipBudget.allowed || !emailBudget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  try {
    const pending = await prisma.pendingRegistration.findFirst({
      where: { email, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      const token = generateToken();

      // Rotate the token rather than adding a row: the old link dies here, so
      // only ever one confirmation link is live per address.
      await prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: {
          tokenHash: hashToken(token),
          expiresAt: tokenExpiry(REGISTRATION_TTL_MS),
        },
      });

      const locale = await getLocale();
      const { subject, html, text } = renderVerifyRegistrationEmail(
        locale,
        `${appUrl}/verify-email?token=${encodeURIComponent(token)}`,
      );

      await sendEmail({ to: email, subject, html, text });
    }
  } catch (error) {
    // Swallowed: an error here would differ by whether a pending signup
    // exists, which is exactly the signal this action must not emit.
    console.error("[auth] Failed to resend confirmation", error);
  }

  return { success: true };
}
