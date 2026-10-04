// Upstash-backed rate limiting (docs/decisions/0007-adopt-core-rules.md row
// 22; docs/specs/core-integrations.md, INT-1..4). The only module that
// imports `@upstash/ratelimit` or `@upstash/redis` (INT-1) — every caller
// goes through `consume`/`peek`/`reset` instead.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { env, liveEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface RateLimitRule {
  // Carried on the rule itself (rather than parsed out of the key) so a
  // failed consume (INT-4) can log which rule tripped without ever logging
  // the key, which may embed a hashed email (INT-3).
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

let defaultRedis: Redis | undefined;

/**
 * The shared Upstash REST client, built lazily so importing this module never
 * requires the env vars to be set (tests inject their own client instead).
 * Only ever called once `isUpstashConfigured()` is true — constructing
 * `Redis` with an undefined URL throws immediately, before a single request
 * is even attempted.
 */
function getDefaultRedis(): Redis {
  if (!defaultRedis) {
    defaultRedis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return defaultRedis;
}

function isUpstashConfigured(): boolean {
  return !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
}

let warnedDisabled = false;

/**
 * INT-5 (docs/specs/core-integrations.md): without Upstash configured, rate
 * limiting is disabled — `consume`/`peek` allow every request and `reset`
 * no-ops — rather than the app refusing to boot or every request failing
 * open through the catch block below with a per-request log line. Logged
 * once per process so local development and a CI run without Upstash don't
 * spam a warning per request.
 */
function warnDisabledOnce(): void {
  if (!warnedDisabled) {
    warnedDisabled = true;
    logger.warn({}, "rate limiting disabled: Upstash is not configured");
  }
}

/**
 * The subset of `Ratelimit`'s own instance surface `consume`/`peek`/`reset`
 * use. Declared here, rather than importing `@upstash/ratelimit`'s own
 * class type, so a test can inject an in-memory fake (`test/fakes/ratelimit.ts`)
 * that never touches a real or local Redis at all — `@upstash/ratelimit`'s
 * Lua scripts carry an Upstash-only Redis flag that local OSS Redis rejects
 * (docs/decisions/0017-upstash-qstash-react-email.md).
 */
export interface RateLimitLimiter {
  limit(identifier: string): Promise<{ success: boolean; remaining: number; reset: number }>;
  getRemaining(identifier: string): Promise<{ remaining: number; reset: number }>;
  resetUsedTokens(identifier: string): Promise<void>;
}

/**
 * Builds the real or fake limiter for a rule. Takes no `redis` parameter:
 * the real factory below closes over the module's own Upstash client, and an
 * injected fake (`test/fakes/ratelimit.ts`) never touches Redis at all, so
 * there is nothing for either to receive.
 */
export type LimiterFactory = (rule: RateLimitRule) => RateLimitLimiter;

const defaultLimiterFactory: LimiterFactory = (rule) =>
  new Ratelimit({
    redis: getDefaultRedis(),
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowMs} ms`),
  });

// One limiter instance per distinct rule shape, keyed by limit+window rather
// than by rule.name: several rule names can share the same limit/window, and
// a sliding-window limiter is pure configuration, so reusing it is just
// avoiding needless allocation.
const limiters = new Map<string, RateLimitLimiter>();

function getLimiter(rule: RateLimitRule, limiterFactory: LimiterFactory): RateLimitLimiter {
  const cacheKey = `${rule.limit}:${rule.windowMs}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;

  const limiter = limiterFactory(rule);
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Increments the counter for `key` under a sliding window and reports
 * whether the caller is within `rule`. Fails open (INT-4) and never sends
 * `key` to the logger, only `rule.name`. `limiterFactory` is a test
 * injection point — every real caller omits it, gets `defaultLimiterFactory`,
 * and skips the "Upstash not configured" short-circuit only when it is
 * actually configured. A caller that passes its own `limiterFactory` (the
 * in-memory fake, `test/fakes/ratelimit.ts`) always skips that short-circuit
 * instead, since it needs no Upstash client at all.
 */
export async function consume(
  key: string,
  rule: RateLimitRule,
  limiterFactory: LimiterFactory = defaultLimiterFactory,
): Promise<RateLimitResult> {
  if (limiterFactory === defaultLimiterFactory && !isUpstashConfigured()) {
    warnDisabledOnce();
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
  try {
    const limiter = getLimiter(rule, limiterFactory);
    const result = await limiter.limit(redisKey(key));

    return {
      allowed: result.success,
      remaining: Math.max(0, result.remaining),
      retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
    };
  } catch {
    // Fail open. A limiter that hard-fails the request when Redis hiccups
    // turns a transient outage into a total auth outage.
    logger.warn({ rule: rule.name }, "rate limit unavailable");
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
}

/** Read-only check that does not consume budget. */
export async function peek(
  key: string,
  rule: RateLimitRule,
  limiterFactory: LimiterFactory = defaultLimiterFactory,
): Promise<RateLimitResult> {
  if (limiterFactory === defaultLimiterFactory && !isUpstashConfigured()) {
    warnDisabledOnce();
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
  try {
    const limiter = getLimiter(rule, limiterFactory);
    const result = await limiter.getRemaining(redisKey(key));

    return {
      allowed: result.remaining > 0,
      remaining: Math.max(0, result.remaining),
      retryAfterMs: 0,
    };
  } catch {
    logger.warn({ rule: rule.name }, "rate limit unavailable");
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
}

// `resetUsedTokens` scans by `{prefix}:{identifier}:*` and is window-agnostic
// (docs/decisions/0007-adopt-core-rules.md row 22) — any `Ratelimit` instance
// built with the default prefix can reset any other's counters, so `reset`
// does not need to know which rule originally wrote them. A throwaway
// 1-request/1s limiter is enough to reach `resetUsedTokens`.
const RESET_RULE: RateLimitRule = { name: "reset", limit: 1, windowMs: 1000 };

/** Clears a counter, e.g. after a successful sign-in. Best effort: does
 * nothing when Upstash is not configured, the same as a stale counter that
 * simply expires on its own. */
export async function reset(
  key: string,
  limiterFactory: LimiterFactory = defaultLimiterFactory,
): Promise<void> {
  if (limiterFactory === defaultLimiterFactory && !isUpstashConfigured()) {
    warnDisabledOnce();
    return;
  }
  try {
    const limiter = getLimiter(RESET_RULE, limiterFactory);
    await limiter.resetUsedTokens(redisKey(key));
  } catch {
    // Best effort; a stale counter expires on its own.
  }
}

/**
 * BAUTH-6 (docs/specs/core-better-auth.md): the storage Better Auth's own
 * rate limiter writes its counters into, so its remaining (non-disabled)
 * paths share Upstash with every rule above rather than falling back to
 * in-memory counters that would not survive a serverless cold start. Built
 * on `consume` so it fails open the same way: unconfigured or unreachable
 * Upstash allows the request rather than taking the auth surface down.
 *
 * Better Auth 1.7.7's `customStorage` contract is a single atomic `consume`
 * (window in seconds, not `RateLimitRule`'s milliseconds) — not the
 * `get`/`set` pair some older versions used.
 */
export function createBetterAuthRateLimitStorage(): {
  consume: (
    key: string,
    rule: { window: number; max: number },
  ) => Promise<{ allowed: boolean; retryAfter: number | null }>;
} {
  return {
    async consume(key, rule) {
      const result = await consume(key, {
        name: `better-auth:${key}`,
        limit: rule.max,
        windowMs: rule.window * 1000,
      });
      return {
        allowed: result.allowed,
        retryAfter: result.allowed ? null : Math.ceil(result.retryAfterMs / 1000),
      };
    },
  };
}

/**
 * Applies the environment prefix (INT-2) and hashes an email segment
 * (INT-3).
 */
export function redisKey(key: string): string {
  // A live read, not `env.VERCEL_ENV`: `lib/env.ts`'s `createEnv` output is
  // resolved once at import time, so a test that `vi.stubEnv`s VERCEL_ENV
  // after that would never be seen through it — the same reason
  // `isDevelopmentRuntime()` in lib/env.ts reads live too.
  const prefix = liveEnv("VERCEL_ENV") || "development";
  const hashed = key.replace(/:email:([^:]+)/, (_match, address: string) => {
    const hash = createHash("sha256").update(address.toLowerCase()).digest("hex");
    return `:email:${hash}`;
  });
  return `${prefix}:${hashed}`;
}
