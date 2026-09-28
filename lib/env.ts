import "dotenv/config";
import { z } from "zod";

// Single validated entry point for server-side configuration.
//
// Before this existed, `lib/prisma.ts` did `${process.env.DATABASE_URL}`, which
// turns a missing variable into the literal string "undefined" and defers the
// failure to the first query. A missing NEXTAUTH_SECRET was worse: NextAuth 4
// silently auto-generates one in development, so JWTs quietly invalidate on
// every restart and the misconfiguration only surfaces in production.
//
// Everything required is validated at import time so a bad deploy fails at
// boot with a readable message instead of at 3am with a stack trace.

const NON_EMPTY = "must be set";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, `DATABASE_URL ${NON_EMPTY}`),
  NEXTAUTH_SECRET: z.string().min(1, `NEXTAUTH_SECRET ${NON_EMPTY}`),
  NEXTAUTH_URL: z.string().url().optional(),

  // Base URL used to build links inside emails. Falls back to NEXTAUTH_URL.
  APP_URL: z.string().url().optional(),

  // Transactional email (password reset, security notices). Optional: when
  // absent the mailer no-ops loudly instead of crashing the request.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Encrypts TOTP secrets at rest. Optional, like email and OAuth: without it
  // two-factor auth simply cannot be switched on, rather than the app refusing
  // to boot. 32 bytes, base64.
  TWO_FACTOR_ENCRYPTION_KEY: z.string().optional(),

  // Shared secret the alert cron authenticates with. Optional, like the rest:
  // without it the run endpoint refuses every request, so alerts simply never
  // fire rather than the app refusing to boot.
  ALERTS_CRON_SECRET: z.string().optional(),

  // OAuth. Each provider is enabled only when both halves are present.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.message}`).join("\n");
    throw new Error(`Invalid server environment. Fix your .env (see .env.example):\n${details}`);
  }

  return parsed.data;
}

export const env = loadEnv();

// A short NEXTAUTH_SECRET weakens the HMAC protecting every session JWT. This
// warns rather than throws so an existing deployment is not bricked by an
// upgrade — but it does need fixing, and rotating it signs everyone out.
if (env.NEXTAUTH_SECRET.length < 32) {
  console.error(
    "[security] NEXTAUTH_SECRET is shorter than 32 characters. Generate a strong one with `openssl rand -base64 32` and redeploy.",
  );
}

export const isEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

// Resend's sandbox sender only delivers to the address the Resend account was
// registered under. In production that is a silent trap: registration becomes
// verify-first the moment email is "configured", so every real user would be
// told to check an inbox that never receives anything, and could never finish
// signing up. Better to shout about it at boot than to discover it from a
// support email.
if (
  isEmailConfigured &&
  process.env.NODE_ENV === "production" &&
  env.EMAIL_FROM?.includes("resend.dev")
) {
  console.error(
    "[email] EMAIL_FROM uses Resend's sandbox sender (resend.dev), which only delivers to your own Resend account address. Registration and password reset will silently fail for everyone else. Verify a domain at resend.com/domains and use an address on it — or unset RESEND_API_KEY to fall back to immediate account creation.",
  );
}

// Two-factor is offered only when a key exists to encrypt secrets with. The
// alternative — storing them in plaintext when the key is missing — would make
// a database leak hand over every enrolled secret.
export const isTwoFactorConfigured = Boolean(env.TWO_FACTOR_ENCRYPTION_KEY);

if (!isTwoFactorConfigured && process.env.NODE_ENV === "production") {
  console.warn(
    "[security] TWO_FACTOR_ENCRYPTION_KEY is not set, so two-factor authentication is unavailable. Generate one with `openssl rand -base64 32`. Note that changing it later makes existing enrolments unreadable.",
  );
}

export const isGoogleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const isGitHubConfigured = Boolean(env.GITHUB_ID && env.GITHUB_SECRET);

interface AppUrlSources {
  APP_URL?: string;
  NEXTAUTH_URL?: string;
  /** Injected by Vercel on every deployment. Host only, no protocol. */
  VERCEL_URL?: string;
}

/**
 * Absolute base URL for links inside emails.
 *
 * There is no request context inside a server action to infer a host from, so
 * this has to come from configuration. The Vercel fallback matters: without it,
 * a deploy that forgets APP_URL silently emails `http://localhost:3000` reset
 * and confirmation links to real users — broken, and invisible until someone
 * complains.
 *
 * `VERCEL_URL` is the deployment-specific host, so previews correctly link to
 * themselves rather than to production. Set APP_URL explicitly in production to
 * get your real domain instead of the generated `*.vercel.app` one.
 *
 * Exported for tests; prefer the `appUrl` constant below.
 */
export function resolveAppUrl(sources: AppUrlSources): string {
  if (sources.APP_URL) return sources.APP_URL;
  if (sources.NEXTAUTH_URL) return sources.NEXTAUTH_URL;
  // Vercel is always HTTPS, and VERCEL_URL carries no protocol of its own.
  if (sources.VERCEL_URL) return `https://${sources.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const appUrl = resolveAppUrl({
  APP_URL: env.APP_URL,
  NEXTAUTH_URL: env.NEXTAUTH_URL,
  VERCEL_URL: process.env.VERCEL_URL,
});
