"use server";

import { hashPassword } from "@/lib/auth/hash";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { hashToken } from "@/lib/auth/tokens";
import { isEmailConfigured } from "@/lib/env";
import { optionalString, requiredString } from "@/lib/form-data";
import { AUTH_ERROR, type AuthErrorCode, forgotPasswordSchema } from "@/server/auth/schema";
import { RATE_LIMITS, consumeRateLimit, getClientIp } from "@/server/rate-limit/service";
import { registerSchema } from "./schema";
import {
  createUserFromPendingRegistration,
  deletePendingRegistrations,
  findPendingRegistration,
  findUserByEmail,
  issuePendingRegistration,
  notifyExistingAccount,
  type RegisterResult,
  registerWithoutEmail,
  reissueConfirmationLink,
} from "./service";

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
  await deletePendingRegistrations(email);

  try {
    const existingUser = await findUserByEmail(email);

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

interface VerifyRegistrationResult {
  success: boolean;
  error?: AuthErrorCode;
  /** Returned on success so the confirmation page can prefill the sign-in link. */
  email?: string;
}

/**
 * Redeems a signup confirmation link and creates the account.
 *
 * This is the only place a credential `User` row is created once email is
 * configured. Requiring a POST (a button on /verify-email, not the link click
 * itself) matters: corporate mail scanners follow every link in an inbox, and
 * a GET that creates accounts would let a scanner consume the token before the
 * recipient ever sees the page.
 */
export async function verifyRegistration(formData: FormData): Promise<VerifyRegistrationResult> {
  const ip = await getClientIp();
  const budget = await consumeRateLimit(
    `verify-registration:ip:${ip}`,
    RATE_LIMITS.resetRedeemPerIp,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const token = formData.get("token");

  if (typeof token !== "string" || token.length === 0) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  // Looked up by digest: the raw token is never stored.
  const pending = await findPendingRegistration(hashToken(token));

  // Missing and expired collapse to one error, so a probe cannot tell a real
  // but stale token from a fabricated one.
  if (!pending || pending.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: AUTH_ERROR.tokenInvalid };
  }

  const createError = await createUserFromPendingRegistration(pending);

  if (createError) {
    return { success: false, error: createError };
  }

  // Consume this token and any sibling attempts on the same address.
  await deletePendingRegistrations(pending.email);

  return { success: true, email: pending.email };
}

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
    await reissueConfirmationLink(email);
  } catch (error) {
    // Swallowed: an error here would differ by whether a pending signup
    // exists, which is exactly the signal this action must not emit.
    console.error("[auth] Failed to resend confirmation", error);
  }

  return { success: true };
}
