# 0013 — Platform runtime: env, database, errors, logging and headers

Status: Accepted · Date: 2026-09-30 · Resolves ADR 0007 rows 11–15

## Context

[ADR 0007](0007-adopt-core-rules.md) rows 11–15 list five phase-6 deviations from `RULES.md` and
`STACK.md`: a hand-rolled env module reading `process.env` directly in several files, a single
`adapter-pg` database module with no `DIRECT_URL` and no migration step in the build, `{ success,
error }` actions with no `Result<T, E>` and no Sentry or correlation id, no health routes, and a
static `Content-Security-Policy` whose `script-src` allows `'unsafe-inline'`. Phase 6's spec,
[docs/specs/core-platform.md](../specs/core-platform.md), closes all five. This record makes
permanent the trade-offs the owner took while approving it.

## Decided

**CSP nonces, with the dynamic rendering they cost.** `Content-Security-Policy` moves from a
static header in `next.config.ts` to a per-request header built in `proxy.ts`, with a fresh
base64 **nonce** of at least 128 bits on `script-src` and no `'unsafe-inline'`. A nonce has to be
fresh per response, so no page depending on it can be pre-rendered — and `app/layout.tsx` passes
it to every page through `<ThemeProvider>`, so every page depends on it. The build's 25 static
(`○`) pages become **dynamic** (`ƒ`): no full-route cache, one `proxy.ts` run per request. Most of
those were already effectively dynamic — the map, search results and every authenticated route
already depended on the session or search state — so the real cost is the landing page and the
legal pages, which lose static optimisation for a policy header.

**Migrations run in the production build only, until phase 12.** `pnpm build` runs
`scripts/migrate-deploy.mjs` between `prisma generate` and `next build`, which runs `prisma migrate
deploy` only when `VERCEL_ENV` is `production` and prints one line and exits `0` otherwise.
Previews share the production database until phase 12 gives them their own (ADR 0007 row 12
placeholder), so migrating from a preview build would apply an unmerged schema to production. A
preview with a pending migration behaves as it does today: the new code runs against the old
schema until someone migrates by hand.

**The Neon adapter on Vercel, `pg` locally, `DIRECT_URL` for migrations.** `lib/db/prisma.ts`
builds the client with `@prisma/adapter-neon` over the pooled `DATABASE_URL` when `VERCEL` is
set — true on every Vercel deployment, preview or production — and with `@prisma/adapter-pg`
otherwise, so local development and CI keep a plain Postgres connection. `prisma.config.ts` gives
Prisma's migration commands `DIRECT_URL` when it is set and falls back to `DATABASE_URL`
otherwise, because a migration needs an unpooled connection and most local setups have only one
URL to give it.

**Sentry ships wired but inert until a DSN exists.** `@sentry/nextjs` is initialised from
`instrumentation.ts` and `instrumentation-client.ts` only when `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` is set; without one, nothing is initialised and nothing is sent, locally
and in every test. Once a DSN exists it reports to Sentry's **EU** region, with
**`dataCollection`** (`lib/sentry-privacy.ts`) turning off user identity, cookies, headers,
request bodies and query strings, database query data and stack-frame local variables — SDK 11's replacement for
`sendDefaultPii: false` — `tracesSampleRate: 0` and no session replay, so the free plan's quota
goes entirely to errors. Every event carries the same
`x-request-id` `proxy.ts` assigns, as a `request_id` tag, so a Sentry event and its log lines can
be matched. Creating the sentry.io project and setting the DSN in Vercel is a manual step, outside
this change.

**`Result<T, E>` for every feature except auth, until phase 11.** `server/alerts/`,
`server/favorites/` and `server/locale/` return `Result` instead of `{ success, error }`; an
unexpected failure now throws and reaches Sentry instead of being caught into an `unexpected`
code. `account`, `registration`, `password-reset`, `email-verification` and `two-factor` keep
`{ success, error }` until phase 11 rewrites them onto Better Auth (ADR 0007 row 25) — converting
their shape now would be thrown away.

## What would change our mind

A second Neon database for previews (phase 12) removes the reason migrations skip non-production
builds; that change updates `scripts/migrate-deploy.mjs` directly rather than amending this
record. Nothing here is expected to change before then.
