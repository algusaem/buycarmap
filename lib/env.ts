import { createEnv } from "@t3-oss/env-nextjs";
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
// boot with a readable message instead of at 3am with a stack trace. Built on
// @t3-oss/env-nextjs so the same schema is Edge-safe (proxy.ts imports it) and
// so a client-side read of a server-only variable throws instead of silently
// returning undefined.

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),

    // Base URL used to build links inside emails. Falls back to NEXTAUTH_URL.
    APP_URL: z.string().url().optional(),

    // Transactional email (password reset, security notices). Optional: when
    // absent the mailer no-ops loudly instead of crashing the request.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Encrypts TOTP secrets at rest. Optional, like email and OAuth: without
    // it two-factor auth simply cannot be switched on, rather than the app
    // refusing to boot.
    TWO_FACTOR_ENCRYPTION_KEY: z.string().optional(),

    // Shared secret the alert cron authenticates with. Optional, like the
    // rest: without it the run endpoint refuses every request, so alerts
    // simply never fire rather than the app refusing to boot.
    ALERTS_CRON_SECRET: z.string().optional(),

    // OAuth. Each provider is enabled only when both halves are present.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),

    // Used by Prisma's migration commands only (prisma.config.ts); falls back
    // to DATABASE_URL when unset.
    DIRECT_URL: z.string().optional(),

    // Upstream marketplace base URLs (FRONT-22, docs/specs/core-frontend.md).
    // Each defaults to the real host, exactly as server/search/service.ts
    // called it before this existed. For e2e only: playwright.config.ts
    // points all three at the local mock upstream server
    // (e2e/fixtures/upstream-server.ts) so a Playwright run never reaches a
    // real marketplace. Production never sets these.
    WALLAPOP_API_BASE_URL: z.string().url().default("https://api.wallapop.com"),
    COCHESNET_API_BASE_URL: z.string().url().default("https://web.gw.coches.net"),
    MILANUNCIOS_BASE_URL: z.string().url().default("https://www.milanuncios.com"),

    // Sentry (lib/sentry.ts, instrumentation.ts). Inert without a DSN.
    SENTRY_DSN: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),

    // Injected by Vercel. VERCEL selects the Neon adapter (lib/db/prisma.ts);
    // VERCEL_ENV gates the production migration (scripts/migrate-deploy.mjs);
    // VERCEL_URL is the deployment-specific host (resolveAppUrl in lib/app-config.ts).
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    VERCEL_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
  },
  // t3-env's own default (`typeof window === "undefined"`) treats a Vitest
  // jsdom test as "the client", so a unit test that merely imports a
  // server-only module transitively (say, via lib/logger.ts) trips the
  // server/client access guard even though nothing is browser code — jsdom
  // fakes `window`, but the process itself is still Node. `process.env.VITEST`
  // is set by Vitest in every one of its worker processes, jsdom or node
  // alike, and is never set in a real build.
  isServer:
    typeof window === "undefined" || (typeof process !== "undefined" && !!process.env.VITEST),
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    const details = issues
      .map((issue) => `  - ${(issue.path ?? []).join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment. Fix your .env (see .env.example):\n${details}`);
  },
});

/**
 * A live read of `NODE_ENV`, for callers that need the current process state
 * rather than the value `env.NODE_ENV` captured when this module first
 * loaded — proxy.ts's per-request development check, specifically. `env.*` is
 * resolved once at import like the rest of `createEnv`'s output; nothing
 * re-reads it later. Still routed through lib/env.ts, so proxy.ts itself
 * never reads `process.env` directly (PLAT-4/PLAT-5, docs/specs/core-platform.md).
 */
export function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}
