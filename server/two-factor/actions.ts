"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { requiredString } from "@/lib/form-data";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { asUserId } from "@/lib/ids";
import { RATE_LIMITS, consumeRateLimit } from "@/server/rate-limit/service";
import { disableTwoFactorSchema, twoFactorCodeSchema, twoFactorPasswordSchema } from "./schema";
import { hasPassword, isTwoFactorEnabled } from "./service";

// BAUTH-11 (docs/specs/core-better-auth.md): enrolment, confirmation,
// disabling and regenerating codes now run on Better Auth's own `twoFactor`
// plugin (lib/auth/auth.ts) rather than lib/auth/two-factor/*, which is
// deleted. Each action still owns the password confirmation, the rate limit
// and the AUTH_ERROR vocabulary the UI already understands — only the TOTP
// math, the secret and the recovery codes themselves now live in the
// plugin's own `two_factors` table.

interface TwoFactorResult {
  success: boolean;
  error?: AuthErrorCode;
}

interface SetupResult extends TwoFactorResult {
  /** For the QR image. */
  otpauthUri?: string;
  /** Shown alongside the QR for anyone who cannot scan it. */
  secret?: string;
  /**
   * Shown once, alongside the QR: the plugin mints these at setup, not at
   * confirmation, so there is no second trip to show them later.
   */
  recoveryCodes?: string[];
}

type ConfirmResult = TwoFactorResult;

interface CodesResult extends TwoFactorResult {
  recoveryCodes?: string[];
}

// Maps the plugin's own APIError codes (node_modules/better-auth's
// TWO_FACTOR_ERROR_CODES and BASE_ERROR_CODES) onto the AUTH_ERROR vocabulary
// the UI already translates. Never imports `better-auth` itself to build
// this map — only lib/auth/auth.ts and lib/auth/auth-client.ts do that
// (BAUTH-1) — so it reads the thrown error structurally instead.
const TWO_FACTOR_ERROR_MAP: Record<string, AuthErrorCode> = {
  INVALID_PASSWORD: AUTH_ERROR.currentPasswordIncorrect,
  TOTP_ALREADY_ENABLED: AUTH_ERROR.totpAlreadyEnabled,
  TOTP_NOT_ENABLED: AUTH_ERROR.totpNotEnabled,
  TWO_FACTOR_NOT_ENABLED: AUTH_ERROR.totpNotEnabled,
  INVALID_CODE: AUTH_ERROR.totpInvalid,
  INVALID_BACKUP_CODE: AUTH_ERROR.totpInvalid,
  INVALID_TWO_FACTOR_COOKIE: AUTH_ERROR.totpInvalid,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: AUTH_ERROR.rateLimited,
  ACCOUNT_TEMPORARILY_LOCKED: AUTH_ERROR.rateLimited,
};

function betterAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("body" in error)) return undefined;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object" || !("code" in body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function mapTwoFactorError(error: unknown): AuthErrorCode {
  const code = betterAuthErrorCode(error);
  return (code && TWO_FACTOR_ERROR_MAP[code]) || AUTH_ERROR.generic;
}

/**
 * `headers()` throws outside a real request scope (a script, or a test
 * calling an action directly) — the same reason `getClientIp()`
 * (server/rate-limit/service.ts) and `getCurrentSession()`
 * (lib/auth/session.ts) guard it.
 */
async function safeHeaders(): Promise<Headers> {
  try {
    return await headers();
  } catch {
    return new Headers();
  }
}

/**
 * The manual-entry key shown next to the QR: the `secret` query parameter on
 * the URI, which the plugin base32-encodes for display — never the raw
 * signing key itself, which never leaves the server in this form.
 */
function parseManualSecret(otpauthUri: string): string {
  const query = otpauthUri.split("?")[1] ?? "";
  return new URLSearchParams(query).get("secret") ?? "";
}

/**
 * Begins enrolment: Better Auth mints a secret and backup codes and stores
 * the secret unverified, so nothing is enforced until a code confirms the
 * authenticator actually works.
 */
export async function startTwoFactorSetup(formData: FormData): Promise<SetupResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const parsed = twoFactorPasswordSchema.safeParse({
    password: requiredString(formData.get("password")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message as AuthErrorCode };
  }

  if (!(await hasPassword(asUserId(user.id)))) {
    // OAuth-only accounts sign in through their provider, which owns its own
    // second factor; there is no password here for the plugin to confirm.
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password },
      headers: await safeHeaders(),
    });

    if (result.method !== "totp" || !result.totpURI) {
      return { success: false, error: AUTH_ERROR.generic };
    }

    return {
      success: true,
      otpauthUri: result.totpURI,
      secret: parseManualSecret(result.totpURI),
      recoveryCodes: result.backupCodes,
    };
  } catch (error) {
    return { success: false, error: mapTwoFactorError(error) };
  }
}

/**
 * Finishes enrolment once the user proves their app is working. The backup
 * codes were already minted and shown at setup (above); this only has to
 * flip the plugin's own `verified`/`twoFactorEnabled` flags.
 */
export async function confirmTwoFactorSetup(formData: FormData): Promise<ConfirmResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const budget = await consumeRateLimit(
    `two-factor-setup:user:${user.id}`,
    RATE_LIMITS.twoFactorPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = twoFactorCodeSchema.safeParse({
    code: requiredString(formData.get("code")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message as AuthErrorCode };
  }

  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await safeHeaders(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: mapTwoFactorError(error) };
  }
}

/**
 * Checks a submitted code — a 6-digit TOTP or a backup code — for the
 * signed-in user, without creating a new session: both `verifyTOTP` and
 * `verifyBackupCode` only mint a session when called from a sign-in
 * challenge (no session on the request yet), and `headers` here always
 * carries a real one. Returns `null` on success, or the `AUTH_ERROR` code to
 * report otherwise.
 */
async function verifyTwoFactorCode(code: string, headers: Headers): Promise<AuthErrorCode | null> {
  try {
    await auth.api.verifyTOTP({ body: { code }, headers });
    return null;
  } catch (totpError) {
    try {
      await auth.api.verifyBackupCode({ body: { code }, headers });
      return null;
    } catch {
      return mapTwoFactorError(totpError);
    }
  }
}

/**
 * Turns 2FA off. Requires the current password *and* a current code.
 *
 * Either alone would undo the protection: a stolen session has no password,
 * and someone who only knows the password still cannot produce a code.
 */
export async function disableTwoFactor(formData: FormData): Promise<TwoFactorResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const budget = await consumeRateLimit(
    `two-factor-disable:user:${user.id}`,
    RATE_LIMITS.twoFactorPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const parsed = disableTwoFactorSchema.safeParse({
    currentPassword: requiredString(formData.get("currentPassword")),
    code: requiredString(formData.get("code")),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message as AuthErrorCode };
  }

  if (!(await isTwoFactorEnabled(asUserId(user.id)))) {
    return { success: false, error: AUTH_ERROR.totpNotEnabled };
  }

  const requestHeaders = await safeHeaders();

  const codeError = await verifyTwoFactorCode(parsed.data.code, requestHeaders);
  if (codeError) {
    return { success: false, error: codeError };
  }

  try {
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.currentPassword },
      headers: requestHeaders,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: mapTwoFactorError(error) };
  }
}

/**
 * Issues a fresh set of recovery codes, invalidating the old ones.
 *
 * Password only, no code: the usual reason to be here is that the previous
 * codes were lost or exposed, and demanding the authenticator as well would
 * lock out exactly the person this is meant to help.
 */
export async function regenerateRecoveryCodes(formData: FormData): Promise<CodesResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  const budget = await consumeRateLimit(
    `two-factor-recovery:user:${user.id}`,
    RATE_LIMITS.twoFactorPerUser,
  );

  if (!budget.allowed) {
    return { success: false, error: AUTH_ERROR.rateLimited };
  }

  const password = requiredString(formData.get("currentPassword"));

  if (!password) {
    return { success: false, error: AUTH_ERROR.passwordRequired };
  }

  if (!(await isTwoFactorEnabled(asUserId(user.id)))) {
    return { success: false, error: AUTH_ERROR.totpNotEnabled };
  }

  try {
    const result = await auth.api.generateBackupCodes({
      body: { password },
      headers: await safeHeaders(),
    });
    return { success: true, recoveryCodes: result.backupCodes };
  } catch (error) {
    return { success: false, error: mapTwoFactorError(error) };
  }
}
