"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { env, isTwoFactorConfigured } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/auth/two-factor/encryption";
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from "@/lib/auth/two-factor/totp";
import { generateRecoveryCodes } from "@/lib/auth/two-factor/recovery-codes";
import { requiredString } from "@/lib/form-data";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { verifyAndConsumeTwoFactor } from "@/server/auth/service";
import { RATE_LIMITS, consumeRateLimit } from "@/server/rate-limit/service";
import { disableTwoFactorSchema, twoFactorCodeSchema } from "./schema";
import {
  disableTwoFactorForUser,
  enableTwoFactor,
  findRecoveryCodesState,
  findTwoFactorConfirmState,
  findTwoFactorDisableState,
  findTwoFactorSetupState,
  replaceRecoveryCodes,
  storePendingTwoFactorSecret,
} from "./service";

interface TwoFactorResult {
  success: boolean;
  error?: AuthErrorCode;
}

interface SetupResult extends TwoFactorResult {
  /** For the QR image. */
  otpauthUri?: string;
  /** Shown alongside the QR for anyone who cannot scan it. */
  secret?: string;
}

interface ConfirmResult extends TwoFactorResult {
  /** Displayed exactly once — they are only recoverable from this response. */
  recoveryCodes?: string[];
}

/**
 * Begins enrolment: mints a secret and stores it encrypted, but leaves
 * `twoFactorEnabledAt` null so nothing is enforced yet.
 *
 * Splitting setup from confirmation is what stops a user locking themselves
 * out — the secret is worthless until they prove their app produces codes from
 * it, and until then login is unchanged.
 */
export async function startTwoFactorSetup(): Promise<SetupResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (!isTwoFactorConfigured) {
    return { success: false, error: AUTH_ERROR.totpUnavailable };
  }

  const record = await findTwoFactorSetupState(user.id);

  if (!record?.password) {
    // OAuth-only accounts sign in through their provider, which owns its own
    // second factor; there is no password prompt here to protect.
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (record.twoFactorEnabledAt) {
    return { success: false, error: AUTH_ERROR.totpAlreadyEnabled };
  }

  const secret = generateTotpSecret();

  // Restarting setup replaces any half-finished secret, so an abandoned
  // attempt cannot later be confirmed by whoever still has that QR open.
  await storePendingTwoFactorSecret(
    user.id,
    encryptSecret(secret, env.TWO_FACTOR_ENCRYPTION_KEY as string),
  );

  return {
    success: true,
    secret,
    otpauthUri: buildOtpAuthUri(secret, record.email),
  };
}

/**
 * Finishes enrolment once the user proves their app is working.
 *
 * Verification here deliberately does NOT go through
 * `verifyAndConsumeTwoFactor`: recovery codes do not exist yet, and burning
 * the step before enabling would reject the very next login.
 */
export async function confirmTwoFactorSetup(formData: FormData): Promise<ConfirmResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: AUTH_ERROR.unauthorized };
  }

  if (!isTwoFactorConfigured) {
    return { success: false, error: AUTH_ERROR.totpUnavailable };
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
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const record = await findTwoFactorConfirmState(user.id);

  if (record?.twoFactorEnabledAt) {
    return { success: false, error: AUTH_ERROR.totpAlreadyEnabled };
  }

  if (!record?.twoFactorSecret) {
    // Confirming without having started.
    return { success: false, error: AUTH_ERROR.totpNotEnabled };
  }

  let secret: string;

  try {
    secret = decryptSecret(record.twoFactorSecret, env.TWO_FACTOR_ENCRYPTION_KEY as string);
  } catch {
    return { success: false, error: AUTH_ERROR.generic };
  }

  const result = verifyTotp(secret, parsed.data.code);

  if (!result.valid || result.step === null) {
    return { success: false, error: AUTH_ERROR.totpInvalid };
  }

  const { plain, hashes } = generateRecoveryCodes();
  const now = new Date();

  await enableTwoFactor(user.id, now, result.step, hashes);

  return { success: true, recoveryCodes: plain };
}

/**
 * Turns 2FA off. Requires the password *and* a current code.
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
    return {
      success: false,
      error: parsed.error.issues[0].message as AuthErrorCode,
    };
  }

  const record = await findTwoFactorDisableState(user.id);

  if (!record?.twoFactorEnabledAt) {
    return { success: false, error: AUTH_ERROR.totpNotEnabled };
  }

  if (!record.password || !(await verifyPassword(parsed.data.currentPassword, record.password))) {
    return { success: false, error: AUTH_ERROR.currentPasswordIncorrect };
  }

  const check = await verifyAndConsumeTwoFactor(
    {
      id: user.id,
      twoFactorSecret: record.twoFactorSecret,
      twoFactorLastStep: record.twoFactorLastStep,
    },
    parsed.data.code,
  );

  if (!check.valid) {
    return { success: false, error: AUTH_ERROR.totpInvalid };
  }

  await disableTwoFactorForUser(user.id);

  return { success: true };
}

/**
 * Issues a fresh set of recovery codes, invalidating the old ones.
 *
 * Password only, no code: the usual reason to be here is that the previous
 * codes were lost or exposed, and demanding the authenticator as well would
 * lock out exactly the person this is meant to help.
 */
export async function regenerateRecoveryCodes(formData: FormData): Promise<ConfirmResult> {
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

  const currentPassword = requiredString(formData.get("currentPassword"));

  if (!currentPassword) {
    return { success: false, error: AUTH_ERROR.passwordRequired };
  }

  const record = await findRecoveryCodesState(user.id);

  if (!record?.twoFactorEnabledAt) {
    return { success: false, error: AUTH_ERROR.totpNotEnabled };
  }

  if (!record.password || !(await verifyPassword(currentPassword, record.password))) {
    return { success: false, error: AUTH_ERROR.currentPasswordIncorrect };
  }

  const { plain, hashes } = generateRecoveryCodes();

  await replaceRecoveryCodes(user.id, hashes);

  return { success: true, recoveryCodes: plain };
}
