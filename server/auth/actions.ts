"use server";

import { cookies, headers } from "next/headers";
import { auth, signSessionToken } from "@/lib/auth/auth";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
  isRateLimited,
  resetRateLimit,
} from "@/server/rate-limit/service";
import { loginEmailRateKey } from "@/server/auth/service";
import { twoFactorCodeSchema } from "@/server/two-factor/schema";
import { requiredString } from "@/lib/form-data";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";

// BAUTH-3 (docs/specs/core-better-auth.md): the server action LoginForm (and
// the no-email registration fallback) calls to sign in with email and
// password. `signIn` keeps AUTH-6's per-account lockout and today's per-IP
// limit (server/rate-limit/service.ts) and today's identical generic failure
// response, and calls `auth.api.signInEmail` for the password check itself.
// A two-factor account never gets a session here — Better Auth's own
// `twoFactor` plugin hook intercepts `/sign-in/email` first and resolves to
// `twoFactorRedirect` instead, after setting its own challenge cookie
// through the `nextCookies` plugin (lib/auth/auth.ts). `verifySignInTotp` and
// `verifySignInBackupCode` below finish that challenge once the UI has a
// code (BAUTH-11).

export type SignInResult =
  | { success: true }
  | { success: false; error: AuthErrorCode }
  | { success: false; twoFactorRequired: true };

// Re-exported so callers (this file's own tests, server/password-reset/actions.ts)
// have one place to import it from without caring that it is defined in
// server/auth/service.ts.
export { loginEmailRateKey };

/**
 * Reads the error code Better Auth's `APIError` carries, without importing
 * `better-auth` itself — only lib/auth/auth.ts and lib/auth/auth-client.ts
 * do that (BAUTH-1).
 */
function betterAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("body" in error)) return undefined;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object" || !("code" in body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * `headers()` throws outside a real request scope (a script, or a test
 * calling an action directly) — the same reason `getClientIp()`
 * (server/rate-limit/service.ts) and `getCurrentSession()`
 * (lib/auth/session.ts) guard it. Better Auth still functions with an empty
 * header set; it only loses IP-based context it would have had anyway.
 */
async function safeHeaders(): Promise<Headers> {
  try {
    return await headers();
  } catch {
    return new Headers();
  }
}

async function setSessionCookie(token: string): Promise<void> {
  const cookie = await signSessionToken(token);
  try {
    const cookieStore = await cookies();
    cookieStore.set(cookie.name, cookie.value, cookie.attributes);
  } catch {
    // No request to carry the cookie on (a script, or a test calling this
    // action directly rather than through a real request).
  }
}

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = requiredString(formData.get("email")).trim().toLowerCase();
  const password = requiredString(formData.get("password"));

  if (!email || !password) {
    return { success: false, error: AUTH_ERROR.generic };
  }

  const emailKey = loginEmailRateKey(email);

  // Per-IP budget is consumed on every attempt, successful or not, so a
  // single host cannot grind through a password list even across accounts.
  const ip = await getClientIp();
  const ipBudget = await consumeRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginPerIp);

  if (!ipBudget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  // Per-account lockout counts only failures (below) and is checked without
  // consuming, so a locked-out account does not extend its own lockout.
  if (await isRateLimited(emailKey, RATE_LIMITS.loginPerEmail)) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await safeHeaders(),
    });

    if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
      // The password was right — nothing has gone wrong yet, so this is a
      // step, not a failure. The plugin already set its own challenge
      // cookie through `nextCookies` (lib/auth/auth.ts).
      return { success: false, twoFactorRequired: true };
    }

    // Clear the failure counter so a user who eventually remembers their
    // password is not locked out by earlier typos.
    await resetRateLimit(emailKey);
    await setSessionCookie(result.token);

    return { success: true };
  } catch {
    // A wrong password and an unknown account answer identically — Better
    // Auth's own message is never surfaced, so the two stay indistinguishable.
    //
    // No `consumeRateLimit` here: `hooks.after` in lib/auth/auth.ts already
    // counts this exact failure once, against the same `emailKey`, every
    // time `auth.api.signInEmail` runs (whether called from here or directly
    // through the HTTP router). Consuming again here double-counted every
    // failure — 4 wrong attempts tripped the 8-attempt lockout, not 8.
    return { success: false, error: AUTH_ERROR.generic };
  }
}

/**
 * Finishes a two-factor sign-in once `signIn` has reported
 * `twoFactorRequired`. Shared by `verifySignInTotp` and
 * `verifySignInBackupCode` below, which only differ in which Better Auth
 * endpoint actually checks the code.
 *
 * Takes no email (BAUTH-3, security review fix): the signed two-factor
 * cookie Better Auth itself set on the prior `/sign-in/email` call is what
 * identifies the account, and the plugin enforces its own per-challenge and
 * per-account lockout against that cookie. An email parameter here would add
 * nothing but a way to enumerate accounts for free and, under the budget
 * this used to key on it, to lock a real account out from a different IP
 * than the attacker's — it is never looked up at all now.
 */
async function verifySignInChallenge(
  formData: FormData,
  verify: (code: string, requestHeaders: Headers) => Promise<{ token?: string | null }>,
): Promise<SignInResult> {
  const parsed = twoFactorCodeSchema.safeParse({ code: requiredString(formData.get("code")) });

  // Consumed on every call, regardless of outcome — including a malformed
  // code — since this is the one budget here keyed on something the caller
  // cannot choose freely.
  const ip = await getClientIp();
  const ipBudget = await consumeRateLimit(`two-factor:ip:${ip}`, RATE_LIMITS.twoFactorPerIp);
  if (!ipBudget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message as AuthErrorCode };
  }

  const requestHeaders = await safeHeaders();

  try {
    const result = await verify(parsed.data.code, requestHeaders);

    if (!result.token) {
      return { success: false, error: AUTH_ERROR.totpInvalid };
    }

    await setSessionCookie(result.token);
    return { success: true };
  } catch (error) {
    // AUTH-10/BAUTH-11: a locked-out account surfaces as a rate limit, not an
    // invalid code, so the UI tells the user to wait rather than keep guessing.
    const code = betterAuthErrorCode(error);
    const rateLimited =
      code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" || code === "ACCOUNT_TEMPORARILY_LOCKED";
    return { success: false, error: rateLimited ? AUTH_ERROR.rateLimited : AUTH_ERROR.totpInvalid };
  }
}

/** Finishes sign-in with a 6-digit TOTP code (AUTH-7, AUTH-9). */
export async function verifySignInTotp(formData: FormData): Promise<SignInResult> {
  return verifySignInChallenge(formData, (code, requestHeaders) =>
    auth.api.verifyTOTP({ body: { code }, headers: requestHeaders }),
  );
}

/** Finishes sign-in with a one-time recovery code (AUTH-10). */
export async function verifySignInBackupCode(formData: FormData): Promise<SignInResult> {
  return verifySignInChallenge(formData, (code, requestHeaders) =>
    auth.api.verifyBackupCode({ body: { code }, headers: requestHeaders }),
  );
}
