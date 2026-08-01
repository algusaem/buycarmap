import { prisma } from "@/lib/prisma";

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
    console.error("[auth] Failed to prune expired auth rows", error);
  }
}

/**
 * Prunes on roughly `PRUNE_PROBABILITY` of calls.
 *
 * Split from the function above so tests can exercise the deletion logic
 * without depending on a coin flip.
 */
export async function maybePruneExpiredAuthRows(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  await pruneExpiredAuthRows();
}
