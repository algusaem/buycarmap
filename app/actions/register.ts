"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { REGISTRATION_TTL_MS, generateToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { appUrl, isEmailConfigured } from "@/lib/env";
import { maybePruneExpiredAuthRows } from "@/lib/auth/cleanup";
import { sendEmail } from "@/lib/email/client";
import {
  renderExistingAccountEmail,
  renderVerifyRegistrationEmail,
} from "@/lib/email/templates/auth-emails";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_ERROR, type AuthErrorCode, registerSchema } from "@/lib/validations/auth";
import { optionalString, requiredString } from "@/lib/validations/form-data";

interface RegisterResult {
  success: boolean;
  error?: AuthErrorCode;
  /**
   * True when the signup is awaiting email confirmation, so the form shows a
   * "check your inbox" panel instead of signing the user straight in.
   *
   * Deliberately identical for a free address and a taken one — the whole
   * point is that the response carries no information about which it was.
   */
  pending?: boolean;
}

// Tells the owner of the address that someone tried to sign up with it.
async function notifyExistingAccount(email: string): Promise<void> {
  const locale = await getLocale();
  const { subject, html, text } = renderExistingAccountEmail(locale, `${appUrl}/login`);
  await sendEmail({ to: email, subject, html, text });
}

// Stores the signup and emails a confirmation link. Nothing is written to
// `User` here, which is what keeps the two branches indistinguishable.
async function issuePendingRegistration(
  email: string,
  hashedPassword: string,
  name: string | null,
): Promise<void> {
  // Opportunistic housekeeping, on a path that already writes a token row.
  await maybePruneExpiredAuthRows();

  const token = generateToken();

  await prisma.pendingRegistration.create({
    data: {
      email,
      password: hashedPassword,
      name,
      // Only the digest is stored; the raw token lives solely in the email.
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

/**
 * Creates the account immediately and reports a taken address.
 *
 * Used only when email is not configured, because verify-first signup cannot
 * work without a way to deliver the link — the alternative would be a
 * deployment where nobody can register at all. This path leaks whether an
 * address is registered; the deployment fixes that by configuring email.
 */
async function registerWithoutEmail(
  email: string,
  hashedPassword: string,
  name: string | null,
): Promise<RegisterResult> {
  console.warn(
    "[auth] Email is not configured, so registration is falling back to immediate account creation. This reveals whether an address is already registered. Set RESEND_API_KEY and EMAIL_FROM to enable verify-first signup.",
  );

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return { success: false, error: AUTH_ERROR.emailTaken };
  }

  try {
    await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
  } catch (error) {
    // The check above is not atomic: the DB's unique index is the real guard.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: AUTH_ERROR.emailTaken };
    }
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true, pending: false };
}

export async function register(formData: FormData): Promise<RegisterResult> {
  const ip = await getClientIp();
  const budget = await consumeRateLimit(`register:ip:${ip}`, RATE_LIMITS.registerPerIp);

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = registerSchema.safeParse({
    // `FormData.get` returns null for an absent field, and the form omits
    // `name` entirely when it is blank. Zod's `.optional()` accepts undefined
    // but rejects null, so reading it raw made every nameless signup fail with
    // a raw Zod message. Normalize at the boundary instead.
    name: optionalString(formData.get("name")),
    email: requiredString(formData.get("email")),
    password: requiredString(formData.get("password")),
    confirmPassword: requiredString(formData.get("confirmPassword")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { email, password, name } = parsed.data;

  // Re-run the strength and breach checks server-side. The client meter is a
  // hint; this is the gate, and it cannot be skipped by posting directly.
  const passwordError = await validateNewPassword(password, [email, name ?? ""]);

  if (passwordError) {
    return { success: false, error: passwordError };
  }

  // Hash before any existence check so every outcome pays the same ~250ms of
  // bcrypt. Response time would otherwise be an enumeration oracle on its own,
  // regardless of what the returned message says.
  const hashedPassword = await hashPassword(password);

  if (!isEmailConfigured) {
    return registerWithoutEmail(email, hashedPassword, name || null);
  }

  // Both branches below run this, so the amount of database work does not
  // vary with whether the address is taken.
  await prisma.pendingRegistration.deleteMany({ where: { email } });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // The person at the keyboard gets the same answer either way; only the
      // mailbox owner learns that a signup was attempted on their address.
      await notifyExistingAccount(email);
    } else {
      await issuePendingRegistration(email, hashedPassword, name || null);
    }
  } catch (error) {
    // Swallowed deliberately: an error response here would differ between the
    // two branches and reintroduce exactly the oracle this design removes.
    console.error("[auth] Registration follow-up failed", error);
  }

  return { success: true, pending: true };
}
