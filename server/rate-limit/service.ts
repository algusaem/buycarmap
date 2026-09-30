import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

// Fixed-window rate limiting for the auth surface.
//
// Backed by Postgres rather than an in-process Map because the app runs on
// Vercel: each request may land on a different (or freshly cold) instance, so
// an in-memory counter would reset constantly and limit nothing in practice.
//
// Without this, `authorizeCredentials` accepts unlimited password guesses, and
// because every guess costs a bcrypt cost-12 comparison (~250ms of CPU), the
// login endpoint doubles as a cheap CPU-exhaustion vector.

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface RateLimitRow {
  count: number;
  expiresAt: Date;
}

export const RATE_LIMITS = {
  // Per-IP ceiling on sign-in attempts. Generous enough for a shared office
  // NAT, tight enough to make online guessing impractical.
  loginPerIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  // Per-account lockout. Counts only *failed* attempts and is cleared on a
  // successful sign-in, so a legitimate user never trips it by typo alone.
  loginPerEmail: { limit: 8, windowMs: 15 * 60 * 1000 },
  registerPerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Password-reset requests send email, so these bound a mail-bomb aimed at
  // someone else's inbox as much as they bound abuse of our own quota.
  resetRequestPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  resetRequestPerEmail: { limit: 4, windowMs: 60 * 60 * 1000 },
  // Guessing a 256-bit token is hopeless, but this caps the noise.
  resetRedeemPerIp: { limit: 15, windowMs: 60 * 60 * 1000 },
  changePasswordPerUser: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Re-sending a signup link is another way to put mail in someone's inbox,
  // so it needs the same per-address ceiling as a reset request.
  resendConfirmationPerEmail: { limit: 4, windowMs: 60 * 60 * 1000 },
  // Verification and email-change links are user-initiated from a signed-in
  // session, so the account is the unit worth bounding.
  emailVerificationPerUser: { limit: 6, windowMs: 60 * 60 * 1000 },
  // A 6-digit code is one in a million, and the ±1 drift window makes three
  // codes live at once — so roughly 1 in 333,000 per guess. Ten attempts per
  // 15 minutes keeps brute force hopeless while leaving room for a mistyped
  // code or a phone whose clock has drifted.
  twoFactorPerUser: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

// Expired rows are harmless but accumulate. Prune opportunistically on a small
// fraction of calls instead of adding a cron job for a housekeeping task.
const PRUNE_PROBABILITY = 0.01;

async function pruneExpired(): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  } catch {
    // Housekeeping only — never let it affect the caller.
  }
}

/**
 * Increments the counter for `key` and reports whether the caller is within
 * the rule. Counting and window-rollover happen in a single atomic statement:
 * a read-then-write would let concurrent attempts both observe the old count
 * and slip past the limit.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const expiresAt = new Date(Date.now() + rule.windowMs);

  try {
    const rows = await prisma.$queryRaw<RateLimitRow[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN EXCLUDED."expiresAt"
          ELSE "RateLimit"."expiresAt"
        END
      RETURNING "count", "expiresAt"
    `;

    if (Math.random() < PRUNE_PROBABILITY) {
      await pruneExpired();
    }

    const row = rows[0];

    if (!row) {
      return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
    }

    const allowed = row.count <= rule.limit;

    return {
      allowed,
      remaining: Math.max(0, rule.limit - row.count),
      retryAfterMs: allowed ? 0 : Math.max(0, new Date(row.expiresAt).getTime() - Date.now()),
    };
  } catch {
    // Fail open. A limiter that hard-fails the request when the database
    // hiccups turns a transient outage into a total auth outage — and the
    // request that follows would have hit the same database anyway.
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
}

/** Read-only check that does not consume budget. */
export async function isRateLimited(key: string, rule: RateLimitRule): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });

    if (!row) return false;
    if (row.expiresAt.getTime() <= Date.now()) return false;

    return row.count >= rule.limit;
  } catch {
    return false;
  }
}

/** Clears a counter, e.g. after a successful sign-in. */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch {
    // Best effort; a stale counter expires on its own.
  }
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * `x-forwarded-for` is client-controlled in general, but on Vercel the proxy
 * appends the real peer address, so the LAST entry is the trustworthy one —
 * taking the first would let an attacker rotate the header and bypass limits
 * entirely. Falls back to a shared bucket when no header is present, which
 * degrades to a global limit rather than to no limit.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();

    const realIp = headerList.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      const entries = forwardedFor.split(",");
      return entries[entries.length - 1].trim();
    }

    return "unknown";
  } catch {
    // Called outside a request scope (e.g. a unit test).
    return "unknown";
  }
}
