import { env } from "@/lib/env";

// Derived, server-only configuration flags and values built on top of
// lib/env.ts's validated `env`. Split out of lib/env.ts (PLAT platform
// migration) because lib/env.ts is imported by instrumentation-client.ts for
// its one client-safe field (NEXT_PUBLIC_SENTRY_DSN); keeping these derived
// values there meant importing lib/env.ts from the browser also evaluated
// every server-only field below, which used to need a dedicated real-browser
// detection guard to avoid tripping the client/server access check. This
// module is never imported by client code, so no such guard is needed here.

export const isEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

export const isGoogleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const isGitHubConfigured = Boolean(env.GITHUB_ID && env.GITHUB_SECRET);

interface AppUrlSources {
  APP_URL?: string;
  BETTER_AUTH_URL?: string;
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
  if (sources.BETTER_AUTH_URL) return sources.BETTER_AUTH_URL;
  // Vercel is always HTTPS, and VERCEL_URL carries no protocol of its own.
  if (sources.VERCEL_URL) return `https://${sources.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const appUrl = resolveAppUrl({
  APP_URL: env.APP_URL,
  BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  VERCEL_URL: env.VERCEL_URL,
});
