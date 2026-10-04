// BAUTH-1 (docs/specs/core-better-auth.md): the one Better Auth instance.
// This and lib/auth/auth-client.ts are the only two modules that import
// `better-auth` — everything else reaches sessions through
// lib/auth/session.ts's getCurrentUser(), the account actions, or
// server/auth/actions.ts's signIn.
//
// Better Auth does not cover every property docs/specs/auth-email-and-oauth.md
// requires (verify-first registration, a per-account lockout, a fail-closed
// breach check, POST-only confirmation links) — those flows stay ours and
// Better Auth's own HTTP endpoints for them are disabled below (BAUTH-6).

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getCookies } from "better-auth/cookies";
import { serializeSignedCookie } from "better-call";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { appUrl, isGitHubConfigured, isGoogleConfigured } from "@/lib/app-config";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-strength";
import { mayAutoLink } from "@/lib/auth/linking";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { uuidv7 } from "@/lib/ids";
import { createBetterAuthRateLimitStorage } from "@/lib/platform/rate-limit";
import { RATE_LIMITS, isRateLimited } from "@/server/rate-limit/service";

// A short BETTER_AUTH_SECRET weakens the HMAC protecting every session —
// moved here from lib/auth/options.ts, which carried the equivalent warning
// for NEXTAUTH_SECRET.
if (env.BETTER_AUTH_SECRET.length < 32) {
  logger.warn(
    {},
    "BETTER_AUTH_SECRET is shorter than 32 characters. Generate a strong one with `openssl rand -base64 32` and redeploy.",
  );
}

const socialProviders = {
  ...(isGoogleConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          // BLOCKER fix (2026-10-04, security review): Google always
          // declares an `idToken` verification config (@better-auth/core's
          // social-providers/google.mjs), so `supportsIdTokenSignIn`
          // (oauth2/verify-id-token.mjs) would otherwise let
          // `POST /sign-in/social` with `{ idToken }` reach
          // `handleOAuthUserInfo` directly — the one path the user-create
          // hook below did not check. This app never drives that path:
          // OAuthButtons.tsx only ever calls `authClient.signIn.social`
          // with no `idToken`, for the redirect flow. Setting this makes
          // `supportsIdTokenSignIn` return false, so the endpoint refuses
          // the request with `ID_TOKEN_NOT_SUPPORTED` before it ever
          // verifies a token or reaches `handleOAuthUserInfo`.
          disableIdTokenSignIn: true,
        },
      }
    : {}),
  ...(isGitHubConfigured
    ? {
        github: {
          clientId: env.GITHUB_ID as string,
          clientSecret: env.GITHUB_SECRET as string,
        },
      }
    : {}),
};

const upstashConfigured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

// AUTH-9: SHA-1, 6 digits, 30s step (the plugin's ±1 step drift is its fixed
// default, not configured here). `as const` keeps `digits` the literal `6`
// Better Auth's own `TOTPOptions` type requires (`6 | 8`), not the widened
// `number` a plain object literal would infer.
const TWO_FACTOR_TOTP_OPTIONS = { digits: 6, period: 30 } as const;

// BAUTH-6 (amended 2026-10-04, security review): only these flows stay
// reachable over HTTP — Google/GitHub sign-in and their callback, the
// no-email registration fallback's sign-in, session read/sign-out, and the
// two generic redirect targets. Every other path Better Auth serves is
// refused, computed below rather than hand-maintained, so a new Better Auth
// version cannot add a reachable path silently.
export const ALLOWED_HTTP_PATHS = [
  "/sign-in/social",
  "/callback/:id",
  "/sign-in/email",
  "/get-session",
  "/sign-out",
  "/ok",
  "/error",
];

function hasStringPath(value: unknown): value is { path: string } {
  // Better Auth attaches `.path` onto each endpoint's handler *function*
  // (better-auth/dist/api/to-auth-endpoints.mjs's `api[key].path = ...`), so
  // this must accept "function", not just "object" — `typeof fn === "object"`
  // is false for every one of them.
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "path" in value &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

/**
 * Identity function used only for its generic constraint: `Parameters<typeof
 * betterAuth>[0]` is `betterAuth`'s own options type, read off the already-
 * imported function rather than a second, separate type import from
 * `@better-auth/core` (not resolvable as a bare specifier from here, since
 * only `better-auth` itself, not its dependency, is in this project's own
 * `package.json`). Gives `coreOptions` below the same contextual typing a
 * direct `betterAuth({...})` call would — its inline callbacks
 * (`password.verify`, `databaseHooks.account.create.before`) are checked
 * against Better Auth's real parameter types instead of inferring `any` —
 * while `coreOptions`'s own inferred type stays the precise literal one
 * (never widened to the options type itself), which is what keeps
 * `auth.api.enableTwoFactor`/`verifyTOTP`/etc. (from the `twoFactor` plugin
 * below) visible on the real instance built from it further down.
 */
function defineAuthOptions<Options extends Parameters<typeof betterAuth>[0]>(
  options: Options,
): Options {
  return options;
}

const coreOptions = defineAuthOptions({
  appName: "BuyCarMap",
  baseURL: appUrl,
  secret: env.BETTER_AUTH_SECRET,

  // Security review fix: without this, Better Auth's own diagnostic lines —
  // hook errors, adapter failures, plugin warnings — write straight to the
  // console, bypassing PLAT-15's JSON formatting, request-id correlation and
  // REDACT_PATHS redaction entirely. `level` is never "success" here: Better
  // Auth's `Logger["log"]` type excludes it from this callback (it is only
  // used for the built-in console logger's own formatting), so every level
  // Pino's `logger` can see here is one it already has a method for.
  //
  // Security review fix (round 2): `args` used to be logged whole, which can
  // carry personal data — Better Auth passes raw error objects and, in at
  // least one path (oauth2/link-account.mjs's "Unable to link account"),
  // the caught error alongside them. Only an `Error` instance survives,
  // passed as Pino's own `err` key so its `errorKey`/`stdSerializers.err`
  // default (node_modules/pino/pino.js) still keeps the message and stack;
  // every other argument is dropped rather than logged.
  logger: {
    log: (level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) => {
      const err = args.find((arg): arg is Error => arg instanceof Error);
      logger[level](err ? { err } : {}, message);
    },
  },

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Every column Better Auth needs already exists under a NextAuth-era name
  // (BAUTH-14); these map its own field names onto them instead of renaming
  // anything in the database.
  user: {
    fields: {
      emailVerified: "emailConfirmed",
    },
  },
  account: {
    fields: {
      accountId: "providerAccountId",
      providerId: "provider",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
    },
    accountLinking: {
      enabled: true,
      // Better Auth's own gate: a provider's email must be verified AND the
      // local account's email must already be verified. No `trustedProviders`
      // here — that option makes Better Auth skip checking the provider's own
      // `emailVerified` claim entirely for the listed providers
      // (better-auth/dist/oauth2/link-account.mjs's `isTrustedProvider`
      // bypass), which is exactly the hole a provider that releases an
      // unverified address could walk through. Our own
      // `databaseHooks.account.create.before` below additionally refuses an
      // account with two-factor on, which this option does not know about.
      requireLocalEmailVerified: true,
    },
  },
  session: {
    fields: {
      token: "sessionToken",
      expiresAt: "expires",
    },
    // Sessions live only in Postgres — no cookie cache, so a revoked session
    // (password change, reset, signOutEverywhere) ends on the very next
    // request rather than whenever a cached cookie happens to expire.
    storeSessionInDatabase: true,
    cookieCache: { enabled: false },
  },

  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },

  socialProviders,

  rateLimit: {
    // INT-5 (docs/specs/core-integrations.md): the same condition
    // lib/platform/rate-limit.ts uses to decide whether Upstash is reachable
    // at all — without it there is nothing for Better Auth's limiter to
    // write counters into.
    enabled: upstashConfigured,
    customStorage: createBetterAuthRateLimitStorage(),
    customRules: {
      // Today's per-IP sign-in ceiling (server/rate-limit/service.ts),
      // carried over so a direct call to this endpoint is bound the same way
      // our own server action is.
      "/sign-in/email": {
        window: RATE_LIMITS.loginPerIp.windowMs / 1000,
        max: RATE_LIMITS.loginPerIp.limit,
      },
    },
  },

  advanced: {
    database: {
      // DATA-1 (docs/specs/core-data-model.md): every id in this app is a
      // UUIDv7, minted the same way everywhere else mints one.
      generateId: () => uuidv7(),
    },
  },

  // BAUTH-9: a new provider auto-links onto an existing local account only
  // when both sides' email are verified and the account has no two-factor —
  // `accountLinking.requireLocalEmailVerified` above (plus the provider's own
  // `emailVerified` claim, now that `trustedProviders` is gone) only checks
  // the first half. Explicit linking from /account is not offered today
  // (BAUTH-9): no UI links a provider, and `/link-social` is not in
  // `ALLOWED_HTTP_PATHS`, so there is no signed-in-session case to exempt
  // here — every account-creation call this hook sees is an implicit link
  // made during sign-in.
  databaseHooks: {
    // BAUTH-9 amendment (2026-10-04, security review round 2): a brand-new
    // user created through a provider reaches this hook from either of two
    // paths — Better Auth's own OAuth callback (`/callback/:id`), or
    // `/sign-in/social`'s idToken branch (api/routes/sign-in.mjs:155-200),
    // which calls the same `handleOAuthUserInfo` (oauth2/link-account.mjs)
    // directly, with no callback round-trip. The google provider's
    // `disableIdTokenSignIn` above is what actually keeps that branch
    // unreachable; `context?.path` checks both paths here anyway, as
    // defense in depth rather than trusting that single provider option.
    // Our own registration flow (server/registration/service.ts) writes
    // `User` rows with `prisma.user.create` directly, bypassing this
    // adapter entirely, and every other Better-Auth-native user-creation
    // path (`/sign-up/email`, `/link-social`) is disabled (BAUTH-6).
    //
    // Refusing here, before Better Auth's adapter ever inserts the row,
    // is what keeps this safe with no follow-up delete needed: returning
    // `false` from a `create.before` hook makes `createWithHooks`
    // (better-auth/dist/db/with-hooks.mjs) return `null` without ever
    // calling the adapter's own `create`, and oauth2/link-account.mjs's
    // brand-new-user branch destructures `createdUser.id` right after —
    // which throws on that `null` and is caught as "unable to create user",
    // so neither the `User` row nor its `Account` row is ever written.
    user: {
      create: {
        before: async (user, context) => {
          const isSocialSignUp =
            context?.path === "/callback/:id" || context?.path === "/sign-in/social";
          if (isSocialSignUp && !user.emailVerified) return false;
        },
      },
    },
    account: {
      create: {
        before: async (account, _context) => {
          // Our own flows (BAUTH-7) insert the "credential" account row
          // directly, never through Better Auth's adapter — this hook only
          // ever sees an OAuth link.
          if (account.providerId === "credential") return;

          const localUser = await prisma.user.findUnique({
            where: { id: account.userId },
            select: {
              twoFactorEnabled: true,
              // Better Auth's own boolean, mapped onto this column by
              // `user.fields.emailVerified` above — not the legacy
              // `emailVerified` DateTime, which Better Auth never writes and
              // which stays null for every account it creates, OAuth or not.
              emailConfirmed: true,
            },
          });
          if (!localUser) return;

          const allowed = mayAutoLink({
            localUser: {
              twoFactorEnabled: localUser.twoFactorEnabled,
              emailConfirmed: localUser.emailConfirmed,
            },
          });

          if (!allowed) return false;
        },
      },
    },
  },

  hooks: {
    // `/change-password` no longer needs a check here: BAUTH-6's amended
    // allowlist disables that path over HTTP (it is not in
    // ALLOWED_HTTP_PATHS above), and our own `changePassword` server action
    // (server/account/actions.ts) already runs `validateNewPassword()` —
    // which includes the breach check — on every call, through `auth.api`.
    before: createAuthMiddleware(async (ctx) => {
      // Defense in depth for BAUTH-6, security review fix: Better Auth's own
      // `disabledPaths` check (better-auth/dist/api/index.mjs's `onRequest`)
      // compares the raw request URL against the disabled list as a literal
      // string, before any route matching — which never matches a
      // parameterized route. A concrete request like
      // `/reset-password/<a-real-token>` sails straight past
      // `disabledPaths.includes("/reset-password/:token")` and reaches the
      // real handler. `ctx.request` is only ever set for a request the HTTP
      // router dispatched (a direct `auth.api.*` call from our own server
      // actions never passes one, confirmed empirically — see this file's
      // git history), and by the time any hook runs, `ctx.path` is already
      // the endpoint's own registered pattern
      // (`path: endpoint.path`, better-auth/dist/api/dispatch.mjs), not the
      // raw URL — so, unlike `disabledPaths` itself, this check is not
      // fooled by a concrete value in place of `:token`.
      if (ctx.request && !ALLOWED_HTTP_PATHS.includes(ctx.path)) {
        throw new APIError("NOT_FOUND");
      }

      if (ctx.path !== "/sign-in/email") return;

      // Not `loginEmailRateKey` (server/auth/service.ts): dependency-cruiser's
      // `auth-server-exception` (.dependency-cruiser.cjs) allows this file to
      // reach only server/rate-limit/service.ts under server/ — reaching
      // server/auth/service.ts too needs that boundary widened first, which
      // is outside this change (RULES.md §1, stop and ask).
      const email = (ctx.body as { email?: string } | undefined)?.email?.trim().toLowerCase();
      if (email && (await isRateLimited(`login:email:${email}`, RATE_LIMITS.loginPerEmail))) {
        throw new APIError("UNAUTHORIZED", { message: AUTH_ERROR.rateLimited });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const email = (ctx.body as { email?: string } | undefined)?.email?.trim().toLowerCase();
      if (!email) return;

      const key = `login:email:${email}`;
      const { consumeRateLimit, resetRateLimit } = await import("@/server/rate-limit/service");

      // AUTH-6: a failed attempt counts against the lockout; a successful one
      // clears it, so earlier typos do not keep counting against a user who
      // has just proved they know the password.
      if (ctx.context.returned instanceof APIError) {
        await consumeRateLimit(key, RATE_LIMITS.loginPerEmail);
      } else {
        await resetRateLimit(key);
      }
    }),
  },

  // BAUTH-11: Better Auth's own two-factor plugin (owner's decision,
  // 2026-10-04). AUTH-9's parameters; `backupCodeOptions.amount` is today's
  // recovery-code count. Registered here so `auth.options.plugins` carries
  // it (BAUTH-11's own test) and the plugin's `two_factors` table is
  // reachable through `auth.api.*` — the sign-in flow
  // (server/auth/actions.ts's `signIn`/`verifySignInTotp`/
  // `verifySignInBackupCode`) and enrolment (server/two-factor/actions.ts)
  // both call this plugin's own `enableTwoFactor`/`verifyTOTP`/
  // `verifyBackupCode`/`disableTwoFactor`/`generateBackupCodes` directly;
  // `lib/auth/two-factor/*`, the module that used to run this itself, is
  // deleted. `nextCookies()` stays last, as Better Auth's own docs require.
  //
  // `twoFactor()` consumes `totpOptions` internally and does not re-expose it
  // on the plugin object it returns, so `totpOptions` is attached onto that
  // object here too — read-only metadata, not a second config path — purely
  // so `auth.options.plugins` lets a test (and anyone else) confirm AUTH-9's
  // parameters without duplicating them.
  plugins: [
    Object.assign(
      twoFactor({
        issuer: "BuyCarMap",
        totpOptions: TWO_FACTOR_TOTP_OPTIONS,
        backupCodeOptions: { amount: 10 },
      }),
      { totpOptions: TWO_FACTOR_TOTP_OPTIONS },
    ),
    nextCookies(),
  ],
});

/**
 * Every HTTP path Better Auth would serve under `coreOptions`, read off a
 * throwaway instance built with no `disabledPaths` of its own. Better Auth
 * attaches each endpoint's own route onto its handler function
 * (`api[key].path = endpoint.path`, better-auth/dist/api/to-auth-endpoints.mjs),
 * so this reads the real, current route list rather than a copy that could
 * silently drift from it as the dependency is upgraded. `auth.node.test.ts`
 * guards the other direction: that every path found this way is accounted
 * for in `ALLOWED_HTTP_PATHS` above, so a version bump that adds a new path
 * fails that test instead of quietly becoming reachable.
 */
function discoverServedPaths(): string[] {
  const discovery = betterAuth({ ...coreOptions, disabledPaths: [] });
  // Nit (security review): this instance only exists to read its `.api`
  // route table below and is then thrown away — nothing ever awaits its
  // lazily-created `$context` (better-auth/dist/auth/base.mjs's
  // `createBetterAuth` calls `initFn(options).then(...)` eagerly), so a
  // config error there would otherwise surface as an unhandled promise
  // rejection instead of surfacing through the real `auth` instance below.
  discovery.$context.catch(() => {
    // Intentionally empty: there is nothing to do with a config error from an
    // instance that exists only to be thrown away below.
  });
  const paths = new Set<string>();
  for (const endpoint of Object.values(discovery.api)) {
    if (hasStringPath(endpoint)) paths.add(endpoint.path);
  }
  return [...paths];
}

const DISABLED_PATHS = discoverServedPaths().filter((path) => !ALLOWED_HTTP_PATHS.includes(path));

export const auth = betterAuth({ ...coreOptions, disabledPaths: DISABLED_PATHS });

// Re-exported so app/api/auth/[...all]/route.ts never has to import
// `better-auth/next-js` itself — only this file and lib/auth/auth-client.ts
// import any `better-auth/*` path (BAUTH-1).
export const { GET, POST } = toNextJsHandler(auth);

// BAUTH-2: the exact cookie name sessions are stored under — derived rather
// than hardcoded, since it carries a `__Secure-` prefix whenever `baseURL`
// is https (`createCookieGetter`, better-auth/dist/cookies). Exported so
// lib/auth/session.ts's getCurrentUser() can read the one named cookie it
// needs without importing `better-auth/cookies` itself (BAUTH-1).
export const SESSION_COOKIE_NAME = getCookies(auth.options).sessionToken.name;

/**
 * Signs a Better Auth session token into the cookie value `getSessionCookie`/
 * `auth.api.getSession` can read back, exactly as `setSessionCookie`
 * (better-auth/dist/cookies) does for a session minted through the HTTP
 * router: `${token}.${hmacSignature}` via `better-call`'s own
 * `serializeSignedCookie`, the same function `ctx.setSignedCookie` calls.
 *
 * This file is the only place allowed to know Better Auth's cookie name,
 * attributes and signing scheme (BAUTH-1); a caller that already has a raw
 * token (`auth.api.signInEmail`'s return value, in a test simulating a
 * second browser) uses this rather than reimplementing the signing itself.
 */
export async function signSessionToken(
  token: string,
): Promise<{ name: string; value: string; attributes: Record<string, unknown> }> {
  const { sessionToken } = getCookies(auth.options);

  const setCookieHeader = await serializeSignedCookie(
    sessionToken.name,
    token,
    env.BETTER_AUTH_SECRET,
    sessionToken.attributes,
  );

  // `serializeSignedCookie` returns the full "name=value; Attr=...; ..."
  // header, with the `${token}.${signature}` value already URL-encoded for
  // that header text. `cookies().set()` encodes its own `value` argument
  // too, so passing the already-encoded string straight through double-
  // encodes it — the cookie round-trips through `cookies().get()` fine
  // (one decode layer cancels one encode layer) but fails real HTTP
  // signature verification, which decodes exactly once. Decoding back to
  // the raw signed value here is what makes `cookies().set()`'s own
  // encoding the only one that happens.
  const rawValue = decodeURIComponent(
    setCookieHeader.slice(setCookieHeader.indexOf("=") + 1).split(";")[0],
  );

  return { name: sessionToken.name, value: rawValue, attributes: sessionToken.attributes };
}

/**
 * BAUTH-7: a real Better Auth session for a user our own flow just created
 * or confirmed outside any HTTP request Better Auth itself handled
 * (registration confirmation). Creates the session row through the internal
 * adapter and signs its cookie via `signSessionToken` above.
 *
 * The caller sets the cookie itself (`next/headers`'s `cookies()`).
 */
export async function createSessionCookie(
  userId: string,
): Promise<{ name: string; value: string; attributes: Record<string, unknown> }> {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(userId);
  return signSessionToken(session.token);
}
