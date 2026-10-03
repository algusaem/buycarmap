"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { createElement } from "react";
import { sendEmail } from "@/lib/platform/email";
import {
  PasswordChangedEmail,
  subject as passwordChangedSubject,
} from "@/emails/PasswordChangedEmail";
import { renderEmail } from "@/emails/render";
import { optionalString, requiredString } from "@/lib/form-data";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { asAccountId, asUserId } from "@/lib/ids";
import { RATE_LIMITS, consumeRateLimit } from "@/server/rate-limit/service";
import { changePasswordServerSchema, updateProfileServerSchema } from "./schema";
import {
  deleteLinkedAccount,
  deleteUser,
  findPasswordAndEmail,
  findPasswordHash,
  findSignInMethods,
  replacePassword,
  revokeAllSessions,
  updateUserName,
} from "./service";

interface AccountResult {
  success: boolean;
  error?: AuthErrorCode;
}

export async function updateProfile(formData: FormData): Promise<AccountResult> {
  // Never trust middleware for authorization: it only decodes the JWT and
  // cannot see revocations. `getCurrentUser` runs the session callback.
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const parsed = updateProfileServerSchema.safeParse({
    name: requiredString(formData.get("name")),
    version: optionalString(formData.get("version")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  try {
    // Scoped to the session's own id — the form carries no user identifier,
    // so there is nothing for a caller to tamper with.
    const matched = await updateUserName(
      asUserId(user.id),
      parsed.data.name || null,
      parsed.data.version,
    );
    if (!matched) {
      return { success: false, error: AUTH_ERROR.conflict };
    }
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}

export async function changePassword(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const userId = asUserId(user.id);

  // Keyed on the account, not the IP: this endpoint needs a valid session, so
  // the account is the meaningful unit to bound.
  const budget = await consumeRateLimit(
    `change-password:user:${user.id}`,
    RATE_LIMITS.changePasswordPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = changePasswordServerSchema.safeParse({
    currentPassword: requiredString(formData.get("currentPassword")),
    password: requiredString(formData.get("password")),
    confirmPassword: requiredString(formData.get("confirmPassword")),
    version: optionalString(formData.get("version")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const { currentPassword, password } = parsed.data;

  const record = await findPasswordAndEmail(userId);

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

  const matched = await replacePassword(
    userId,
    await hashPassword(password),
    now,
    parsed.data.version,
  );
  if (!matched) {
    return { success: false, error: AUTH_ERROR.conflict };
  }

  const locale = await getCurrentLocale();
  const { html, text } = await renderEmail(createElement(PasswordChangedEmail, { locale }));
  await sendEmail({
    to: record.email,
    subject: passwordChangedSubject(locale, { locale }),
    html,
    text,
  });

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
    await revokeAllSessions(asUserId(user.id));
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
export async function unlinkAccount(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const provider = formData.get("provider");

  if (typeof provider !== "string" || provider.length === 0) {
    return { success: false, error: AUTH_ERROR.generic };
  }

  const record = await findSignInMethods(asUserId(user.id));

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const target = record.accounts.find((a) => a.provider === provider);

  if (!target) {
    // Already gone; nothing to do, and saying so reveals nothing.
    return { success: true };
  }

  const wouldBeLocallyUnreachable = !record.password && record.accounts.length <= 1;

  if (wouldBeLocallyUnreachable) {
    return { success: false, error: AUTH_ERROR.lastSignInMethod };
  }

  try {
    await deleteLinkedAccount(asAccountId(target.id));
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}

export async function deleteAccount(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const record = await findPasswordHash(asUserId(user.id));

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
    await deleteUser(asUserId(user.id));
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true };
}
