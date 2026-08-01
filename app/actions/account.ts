"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordChangedEmail } from "@/lib/email/templates/auth-emails";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";
import {
  AUTH_ERROR,
  type AuthErrorCode,
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/validations/auth";
import { requiredString } from "@/lib/validations/form-data";

interface AccountResult {
  success: boolean;
  error?: AuthErrorCode;
}

export async function updateProfile(
  formData: FormData,
): Promise<AccountResult> {
  // Never trust middleware for authorization: it only decodes the JWT and
  // cannot see revocations. `getCurrentUser` runs the session callback.
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const parsed = updateProfileSchema.safeParse({
    name: requiredString(formData.get("name")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      // Scoped to the session's own id — the form carries no user identifier,
      // so there is nothing for a caller to tamper with.
      data: { name: parsed.data.name || null },
    });
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}

export async function changePassword(
  formData: FormData,
): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  // Keyed on the account, not the IP: this endpoint needs a valid session, so
  // the account is the meaningful unit to bound.
  const budget = await consumeRateLimit(
    `change-password:user:${user.id}`,
    RATE_LIMITS.changePasswordPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: requiredString(formData.get("currentPassword")),
    password: requiredString(formData.get("password")),
    confirmPassword: requiredString(formData.get("confirmPassword")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { currentPassword, password } = parsed.data;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true, email: true },
  });

  if (!record?.password) {
    // OAuth-only account: there is no current password to verify, so this form
    // does not apply. (Setting a first password would need its own flow.)
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  // Requiring the current password is what stops a stolen session, or someone
  // at an unlocked laptop, from silently taking the account over permanently.
  if (!(await verifyPassword(currentPassword, record.password))) {
    return { success: false, error: AUTH_ERROR.currentPasswordIncorrect };
  }

  if (await verifyPassword(password, record.password)) {
    return { success: false, error: AUTH_ERROR.passwordReused };
  }

  const passwordError = await validateNewPassword(password, [record.email]);

  if (passwordError) {
    return { success: false, error: passwordError };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(password), passwordChangedAt: now },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  const locale = await getLocale();
  await sendEmail({ to: record.email, ...renderPasswordChangedEmail(locale) });

  return { success: true };
}

/**
 * Revokes every session, including this device's.
 *
 * `passwordChangedAt` is the session-revocation clock (see lib/auth/options.ts):
 * any JWT stamped before it is rejected on the next revalidation. Bumping it
 * without touching the password is exactly the "sign out everywhere" primitive
 * — the field name is historical, its job is broader.
 */
export async function signOutEverywhere(): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordChangedAt: new Date() },
      }),
      // Adapter-backed sessions, if OAuth is enabled.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}

/**
 * Disconnects a linked OAuth provider.
 *
 * Refuses when it would leave the account unreachable: an OAuth-only user who
 * unlinks their sole provider would have no password to fall back on and no
 * way back in. Password reset could not rescue them either, since a
 * passwordless account is skipped by that flow.
 */
export async function unlinkAccount(
  formData: FormData,
): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const provider = formData.get("provider");

  if (typeof provider !== "string" || provider.length === 0) {
    return { success: false, error: AUTH_ERROR.generic };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      password: true,
      accounts: { select: { id: true, provider: true } },
    },
  });

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const target = record.accounts.find((a) => a.provider === provider);

  if (!target) {
    // Already gone; nothing to do, and saying so reveals nothing.
    return { success: true };
  }

  const wouldBeLocallyUnreachable =
    !record.password && record.accounts.length <= 1;

  if (wouldBeLocallyUnreachable) {
    return { success: false, error: AUTH_ERROR.lastSignInMethod };
  }

  try {
    await prisma.account.delete({ where: { id: target.id } });
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}

export async function deleteAccount(
  formData: FormData,
): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  // Credential accounts must re-enter their password; deletion is irreversible
  // and cascades to every related row. OAuth-only accounts have no password to
  // check, so the typed-email confirmation on the form is the only guard there.
  if (record.password) {
    const password = formData.get("password");

    if (typeof password !== "string" || password.length === 0) {
      return { success: false, error: AUTH_ERROR.passwordRequired };
    }

    if (!(await verifyPassword(password, record.password))) {
      return { success: false, error: AUTH_ERROR.currentPasswordIncorrect };
    }
  }

  try {
    // Sessions, accounts, tokens and search history all cascade from here.
    await prisma.user.delete({ where: { id: user.id } });
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}
