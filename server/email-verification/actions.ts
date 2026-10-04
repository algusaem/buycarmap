"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { hashToken } from "@/lib/auth/tokens";
import { createElement } from "react";
import { appUrl } from "@/lib/app-config";
import { sendEmail } from "@/lib/platform/email";
import { EmailChangeEmail, subject as emailChangeSubject } from "@/emails/EmailChangeEmail";
import {
  EmailChangedNoticeEmail,
  subject as emailChangedNoticeSubject,
} from "@/emails/EmailChangedNoticeEmail";
import {
  VerifyEmailAddressEmail,
  subject as verifyEmailAddressSubject,
} from "@/emails/VerifyEmailAddressEmail";
import { renderEmail } from "@/emails/render";
import { requiredString } from "@/lib/form-data";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { findPasswordAndEmail } from "@/server/account/service";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { asUserId } from "@/lib/ids";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/server/rate-limit/service";
import { changeEmailSchema } from "./schema";
import {
  findEmailVerificationState,
  findEmailVerificationToken,
  findUserIdByEmail,
  redeemEmailVerificationToken,
  replaceVerificationToken,
} from "./service";

interface EmailVerificationResult {
  success: boolean;
  error?: AuthErrorCode;
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

  const record = await findEmailVerificationState(asUserId(user.id));

  if (!record) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (record.emailVerified) {
    return { success: false, error: AUTH_ERROR.alreadyVerified };
  }

  const token = await replaceVerificationToken(asUserId(user.id), null);
  const locale = await getCurrentLocale();
  const props = {
    locale,
    verifyUrl: `${appUrl}/confirm-email?token=${encodeURIComponent(token)}`,
  };
  const { html, text } = await renderEmail(createElement(VerifyEmailAddressEmail, props));

  await sendEmail({
    to: record.email,
    subject: verifyEmailAddressSubject(locale, props),
    html,
    text,
  });

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

  const record = await findPasswordAndEmail(asUserId(user.id));

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

  const existing = await findUserIdByEmail(newEmail);

  // A taken target address returns the same success as a free one and simply
  // sends nothing. The alternative would let a signed-in user probe addresses;
  // this caps that at the 6/hour rate limit and reveals nothing per attempt.
  // The unique index is still the real guard at redemption time.
  if (!existing) {
    const token = await replaceVerificationToken(asUserId(user.id), newEmail);
    const locale = await getCurrentLocale();
    const props = {
      locale,
      confirmUrl: `${appUrl}/confirm-email?token=${encodeURIComponent(token)}`,
    };
    const { html, text } = await renderEmail(createElement(EmailChangeEmail, props));

    await sendEmail({ to: newEmail, subject: emailChangeSubject(locale, props), html, text });
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

  const record = await findEmailVerificationToken(hashToken(token));

  // Missing, expired and already-used collapse to one error.
  if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  const previousEmail = record.user.email;
  const now = new Date();

  const redeemError = await redeemEmailVerificationToken(
    { id: record.id, userId: asUserId(record.userId), newEmail: record.newEmail },
    now,
  );

  if (redeemError) {
    return { success: false, error: redeemError };
  }

  // Tell the old address that the account moved, so its owner can react if the
  // change was not theirs. Best effort — the change already succeeded.
  if (record.newEmail) {
    const locale = await getCurrentLocale();
    const { html, text } = await renderEmail(createElement(EmailChangedNoticeEmail, { locale }));
    await sendEmail({
      to: previousEmail,
      subject: emailChangedNoticeSubject(locale, { locale }),
      html,
      text,
    });
  }

  return { success: true };
}
