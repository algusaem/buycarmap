import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/hash";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
  isRateLimited,
  resetRateLimit,
} from "@/server/rate-limit/service";
import { verifyAndConsumeTwoFactor } from "@/server/two-factor/service";
import { purgeSoftDeletedRows } from "@/server/retention/service";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { logger } from "@/lib/logger";

// The auth core other features reach through this file (docs/specs/core-layout.md
// LAYOUT-6): credentials authorization and expired-token housekeeping.

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export function loginEmailRateKey(email: string): string {
  return `login:email:${email}`;
}

// Credentials-provider authorization, extracted from the NextAuth route so it
// can be unit-tested in isolation. Returns the user on success, null otherwise.
//
// Returning null yields a generic "CredentialsSignin" error, so a wrong
// password and an unknown account are indistinguishable to the caller.
// Throwing, by contrast, propagates the message to the client (NextAuth 4
// redirects with `error=<message>`) — used only for rate limiting, where the
// user genuinely needs to know why they are being turned away and the signal
// reveals nothing about whether the account exists.
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password" | "totp", string>> | undefined,
): Promise<AuthorizedUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = credentials.email.trim().toLowerCase();
  const emailKey = loginEmailRateKey(email);

  // Per-IP budget is consumed on every attempt, successful or not, so a single
  // host cannot grind through a password list even across many accounts.
  const ip = await getClientIp();
  const ipBudget = await consumeRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginPerIp);

  if (!ipBudget.allowed) {
    throw new Error(AUTH_ERROR.rateLimited);
  }

  // Per-account lockout counts only failures (see below) and is checked without
  // consuming, so a locked-out account does not extend its own lockout.
  //
  // Tradeoff: this lets someone deliberately lock a known address out for the
  // window length. The window is short (15 min) and the per-IP budget bounds
  // how cheaply it can be sustained, which is the usual balance — the
  // alternative is leaving online password guessing unbounded.
  if (await isRateLimited(emailKey, RATE_LIMITS.loginPerEmail)) {
    throw new Error(AUTH_ERROR.rateLimited);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // `user.password` is null for accounts created through OAuth. Treat those
  // exactly like a wrong password — telling the caller "this account exists but
  // uses Google" would be an enumeration oracle.
  if (!user?.password) {
    // Equalize timing with the found-user path (see DUMMY_PASSWORD_HASH).
    await verifyPassword(credentials.password, DUMMY_PASSWORD_HASH);
    await consumeRateLimit(emailKey, RATE_LIMITS.loginPerEmail);
    return null;
  }

  const isValidPassword = await verifyPassword(credentials.password, user.password);

  if (!isValidPassword) {
    await consumeRateLimit(emailKey, RATE_LIMITS.loginPerEmail);
    return null;
  }

  // Second factor, checked only once the password is already correct. That
  // ordering matters: `totpRequired` tells the caller an account has 2FA on,
  // which is harmless to someone who has just proved the credentials, and
  // unreachable to anyone who has not.
  if (user.twoFactorEnabledAt) {
    const submittedCode = credentials.totp?.trim();

    if (!submittedCode) {
      throw new Error(AUTH_ERROR.totpRequired);
    }

    // Bounded separately from the password limiter: guessing a 6-digit code is
    // a different attack from guessing a password, and the account is already
    // identified at this point.
    const codeBudget = await consumeRateLimit(
      `two-factor:user:${user.id}`,
      RATE_LIMITS.twoFactorPerUser,
    );

    if (!codeBudget.allowed) {
      throw new Error(AUTH_ERROR.rateLimited);
    }

    const check = await verifyAndConsumeTwoFactor(
      {
        id: user.id,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorLastStep: user.twoFactorLastStep,
      },
      submittedCode,
    );

    if (!check.valid) {
      await consumeRateLimit(emailKey, RATE_LIMITS.loginPerEmail);
      throw new Error(AUTH_ERROR.totpInvalid);
    }
  }

  // Clear the failure counter so a user who eventually remembers their password
  // is not locked out by earlier typos.
  await resetRateLimit(emailKey);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

// Expired tokens are already rejected on use, so they are harmless — but
// nothing deleted them, so the tables grew without bound. `RateLimit` already
// self-prunes; these three did not.
//
// Pruned opportunistically on a fraction of the requests that create rows,
// rather than by a cron job: the app has no scheduler, and adding one for
// housekeeping this cheap would be more moving parts than the problem is worth.

const PRUNE_PROBABILITY = 0.02;

/** Deletes every expired token row. Never throws. */
export async function pruneExpiredAuthRows(): Promise<void> {
  const now = new Date();

  try {
    // Independent tables, so there is no ordering constraint between them.
    await Promise.all([
      prisma.pendingRegistration.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    ]);
  } catch (error) {
    // Housekeeping only — it must never affect the request that triggered it.
    logger.error({ err: error }, "Failed to prune expired auth rows");
  }
}

/**
 * The actual housekeeping, run from inside `after()` below so it never
 * delays the response that happened to trigger it (INT-10,
 * docs/specs/core-integrations.md). Wrapped in its own try/catch: a failure
 * here must never reach the caller — there is no request left to fail by
 * the time this runs — and is reported to Sentry rather than only logged,
 * since nothing else will ever retry it.
 *
 * DATA-12 (docs/specs/core-data-model.md): also runs the soft-delete purge
 * (`server/retention/service.ts`), on the same opportunistic schedule rather
 * than a scheduler of its own — a cross-feature import through `service.ts`,
 * which `.dependency-cruiser.cjs`'s `cross-feature-only-service-or-schema`
 * rule allows.
 */
async function runDeferredHousekeeping(): Promise<void> {
  try {
    await pruneExpiredAuthRows();
    await purgeSoftDeletedRows(new Date());
  } catch (error) {
    logger.error({ err: error }, "Failed post-response auth housekeeping");
    Sentry.captureException(error);
  }
}

/**
 * Prunes on roughly `PRUNE_PROBABILITY` of calls.
 *
 * Split from `runDeferredHousekeeping` so tests can exercise the deletion
 * logic without depending on a coin flip.
 */
export async function maybePruneExpiredAuthRows(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;

  try {
    after(runDeferredHousekeeping);
  } catch {
    // `after()` throws when called outside a request scope (INT-10 is a
    // response-deferral mechanism — it has nothing to defer to when there is
    // no request in flight, e.g. a script or a test calling this directly).
    // Fall back to running the housekeeping inline rather than losing it.
    await runDeferredHousekeeping();
  }
}
