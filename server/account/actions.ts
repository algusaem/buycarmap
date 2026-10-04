"use server";

import { getCurrentSessionId, getCurrentUser } from "@/lib/auth/session";
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
import { asAccountId, asSessionId, asUserId } from "@/lib/ids";
import { can } from "@/lib/auth/permissions";
import { RATE_LIMITS, consumeRateLimit } from "@/server/rate-limit/service";
import { changePasswordServerSchema, updateProfileServerSchema } from "./schema";
import {
  deleteLinkedAccount,
  deleteOtherSessions,
  deleteSession,
  deleteUser,
  findMySessions,
  findPasswordAndEmail,
  findPasswordHash,
  findSessionOwner,
  findSignInMethods,
  replacePassword,
  revokeAllSessions,
  updateUserName,
} from "./service";

export interface AccountResult {
  success: boolean;
  error?: AuthErrorCode;
}

export async function updateProfile(formData: FormData): Promise<AccountResult> {
  // Never trust proxy.ts for authorization: it only checks whether the
  // session cookie is present and cannot see a revocation. `getCurrentUser`
  // calls `auth.api.getSession()`, which does.
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
  // BAUTH-2: this device's own session survives; every other one does not.
  const currentSessionId = await getCurrentSessionId();

  const matched = await replacePassword(
    userId,
    await hashPassword(password),
    now,
    parsed.data.version,
    currentSessionId,
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
 * BAUTH-2 (docs/specs/core-better-auth.md): sessions live in Postgres with no
 * cookie cache, so deleting every row for this user (`revokeAllSessions`,
 * server/account/service.ts) ends them on the very next request —
 * `getCurrentUser()` calls `auth.api.getSession()`, which simply finds
 * nothing. `passwordChangedAt` is still bumped alongside the delete, but it
 * is no longer what revocation depends on.
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

  // BLOCKER fix (security review): "credential" is Better Auth's own
  // sign-in plumbing (BAUTH-14's dual-write of a password into an `accounts`
  // row), never a provider the user connected from this page. Deleting it
  // would silently break `auth.api.signInEmail` — which reads this row, not
  // `User.password` — while this very page kept showing a password as set.
  // `lastSignInMethod` is the same code the stranding refusal below already
  // uses, and it fits here too: removing this row removes the only way the
  // account actually signs in.
  if (provider === "credential") {
    return { success: false, error: AUTH_ERROR.lastSignInMethod };
  }

  const record = await findSignInMethods(asUserId(user.id));

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  // Never counted as a sign-in method a user could fall back on here — it is
  // the password's own plumbing, which `record.password` already represents
  // directly, so counting it again would double-count a single method as two.
  const oauthAccounts = record.accounts.filter((a) => a.provider !== "credential");
  const target = oauthAccounts.find((a) => a.provider === provider);

  if (!target) {
    // Already gone; nothing to do, and saying so reveals nothing.
    return { success: true };
  }

  const wouldBeLocallyUnreachable = !record.password && oauthAccounts.length <= 1;

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

export interface MySession {
  id: string;
  // "" rather than null for a row with no recorded device — a session
  // created outside a real browser request (an older row, or a test). The UI
  // renders this the same way as an unrecognised device, never a blank cell.
  userAgent: string;
  ipAddress: string;
  lastUsedAt: Date;
  current: boolean;
}

/**
 * BAUTH-4: the signed-in user's own sessions, for the "Active sessions"
 * section on /account. `current` marks the session backing this very
 * request, so the UI can label it "This device" and hide its own revoke
 * button.
 */
export async function listMySessions(): Promise<MySession[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const [sessions, currentSessionId] = await Promise.all([
    findMySessions(asUserId(user.id)),
    getCurrentSessionId(),
  ]);

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent ?? "",
    ipAddress: session.ipAddress ?? "",
    lastUsedAt: session.updatedAt,
    current: session.id === currentSessionId,
  }));
}

/**
 * BAUTH-4: revokes one of the signed-in user's own sessions.
 * `lib/auth/permissions.ts`'s `can()` refuses another user's, the same way
 * every other ownership check in this feature does (BAUTH-17).
 */
export async function revokeMySession(sessionId: string): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const id = asSessionId(sessionId);
  const ownerId = await findSessionOwner(id);

  if (!ownerId || !can(user, "delete", { type: "session", userId: ownerId })) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  await deleteSession(id);

  return { success: true };
}

/**
 * BAUTH-4: "Sign out of all other sessions" — keeps this device's own
 * session alive, unlike signOutEverywhere which keeps none.
 */
export async function revokeOtherMySessions(): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const currentSessionId = await getCurrentSessionId();
  await deleteOtherSessions(asUserId(user.id), currentSessionId);

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
