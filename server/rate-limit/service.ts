import { headers } from "next/headers";
import { consume, peek, reset } from "@/lib/platform/rate-limit";
import type { LimiterFactory, RateLimitRule } from "@/lib/platform/rate-limit";

// Rate limiting for the auth surface, backed by Upstash Redis
// (docs/decisions/0017-upstash-qstash-react-email.md;
// docs/specs/core-integrations.md, INT-1). This module keeps its public API
// and every `RATE_LIMITS` value from the old Postgres-backed implementation;
// only the storage moved, to `lib/platform/rate-limit.ts`'s adapter.
//
// Without this, `signIn` (server/auth/actions.ts) accepts unlimited password guesses, and
// because every guess costs a bcrypt cost-12 comparison (~250ms of CPU), the
// login endpoint doubles as a cheap CPU-exhaustion vector.

export type { RateLimitRule };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export const RATE_LIMITS = {
  // Per-IP ceiling on sign-in attempts. Generous enough for a shared office
  // NAT, tight enough to make online guessing impractical.
  loginPerIp: { name: "loginPerIp", limit: 20, windowMs: 15 * 60 * 1000 },
  // Per-account lockout. Counts only *failed* attempts and is cleared on a
  // successful sign-in, so a legitimate user never trips it by typo alone.
  loginPerEmail: { name: "loginPerEmail", limit: 8, windowMs: 15 * 60 * 1000 },
  registerPerIp: { name: "registerPerIp", limit: 5, windowMs: 60 * 60 * 1000 },
  // Password-reset requests send email, so these bound a mail-bomb aimed at
  // someone else's inbox as much as they bound abuse of our own quota.
  resetRequestPerIp: { name: "resetRequestPerIp", limit: 10, windowMs: 60 * 60 * 1000 },
  resetRequestPerEmail: { name: "resetRequestPerEmail", limit: 4, windowMs: 60 * 60 * 1000 },
  // Guessing a 256-bit token is hopeless, but this caps the noise.
  resetRedeemPerIp: { name: "resetRedeemPerIp", limit: 15, windowMs: 60 * 60 * 1000 },
  changePasswordPerUser: { name: "changePasswordPerUser", limit: 10, windowMs: 60 * 60 * 1000 },
  // Re-sending a signup link is another way to put mail in someone's inbox,
  // so it needs the same per-address ceiling as a reset request.
  resendConfirmationPerEmail: {
    name: "resendConfirmationPerEmail",
    limit: 4,
    windowMs: 60 * 60 * 1000,
  },
  // Verification and email-change links are user-initiated from a signed-in
  // session, so the account is the unit worth bounding.
  emailVerificationPerUser: {
    name: "emailVerificationPerUser",
    limit: 6,
    windowMs: 60 * 60 * 1000,
  },
  // A 6-digit code is one in a million, and the ±1 drift window makes three
  // codes live at once — so roughly 1 in 333,000 per guess. Ten attempts per
  // 15 minutes keeps brute force hopeless while leaving room for a mistyped
  // code or a phone whose clock has drifted.
  twoFactorPerUser: { name: "twoFactorPerUser", limit: 10, windowMs: 15 * 60 * 1000 },
  // BAUTH-3 (docs/specs/core-better-auth.md), security review fix: the
  // sign-in challenge (`verifySignInTotp`/`verifySignInBackupCode`,
  // server/auth/actions.ts) takes no email, so there is no account to key a
  // per-account budget on without accepting one from the caller — which
  // would let an attacker enumerate accounts for free and lock a victim out
  // by guessing against their address from a different IP. This per-IP
  // budget is consumed on every call instead, on top of the plugin's own
  // per-challenge and per-account lockout (both bound to the signed
  // two-factor cookie, not to anything the caller asserts).
  twoFactorPerIp: { name: "twoFactorPerIp", limit: 20, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Increments the counter for `key` and reports whether the caller is within
 * the rule. `limiterFactory` exists only so `service.integration.test.ts`
 * can inject the in-memory fake (`test/fakes/ratelimit.ts`); every real
 * caller omits it.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  limiterFactory?: LimiterFactory,
): Promise<RateLimitResult> {
  return consume(key, rule, limiterFactory);
}

/** Read-only check that does not consume budget. */
export async function isRateLimited(
  key: string,
  rule: RateLimitRule,
  limiterFactory?: LimiterFactory,
): Promise<boolean> {
  const result = await peek(key, rule, limiterFactory);
  return !result.allowed;
}

/** Clears a counter, e.g. after a successful sign-in. */
export async function resetRateLimit(key: string, limiterFactory?: LimiterFactory): Promise<void> {
  await reset(key, limiterFactory);
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
