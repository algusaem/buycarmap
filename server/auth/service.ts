import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { purgeSoftDeletedRows } from "@/server/retention/service";
import { logger } from "@/lib/logger";

// The auth core other features reach through this file (docs/specs/core-layout.md
// LAYOUT-6): expired-token housekeeping. Credentials authorization used to
// live here too (`authorizeCredentials`), but BAUTH-3/BAUTH-11
// (docs/specs/core-better-auth.md) moved sign-in onto
// `auth.api.signInEmail`/`verifyTOTP`/`verifyBackupCode` directly —
// server/auth/actions.ts's `signIn` and its two-factor follow-ups now own
// every check this function used to make, so it had no remaining caller and
// was deleted along with lib/auth/two-factor/*.

// Kept here (not moved into actions.ts alongside `signIn`) because
// server/password-reset/actions.ts also needs it, and cross-feature imports
// may only reach a `service.ts`/`schema.ts`
// (`.dependency-cruiser.cjs`'s `cross-feature-only-service-or-schema` rule).
export function loginEmailRateKey(email: string): string {
  return `login:email:${email}`;
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
