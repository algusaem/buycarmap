# Platform: env, database, errors, logging and headers (migration phase 6)

Key: PLAT
Status: Implemented
Last updated: 2026-09-30

---

## Problem

The runtime plumbing predates the core and deviates from it in five places (`docs/decisions/0007-adopt-core-rules.md` rows 11–15):

- **Env.** `lib/env.ts` is a hand-rolled Zod module that runs at import time, loads `dotenv` itself and warns through `console`. `process.env` is still read directly in `lib/db/prisma.ts`, `proxy.ts` and `next.config.ts`, so a missing variable there is not caught by any schema (`RULES.md` §14, `STACK.md` §11).
- **Database.** `lib/db/prisma.ts` always uses `@prisma/adapter-pg` with one `DATABASE_URL`. There is no pooled/direct split, and the build never runs `prisma migrate deploy`, so a schema change reaches production only when someone migrates by hand (`STACK.md` §3, §6). The file also casts `globalThis` with `as unknown as` (issue #47).
- **Errors and logging.** Server Actions return `{ success, error }` and catch every failure into an `unexpected` code, so nothing unexpected is ever reported anywhere. Twelve `console.*` calls in application code write unstructured text with no redaction. There is no Sentry and no correlation id (`STACK.md` §8, `RULES.md` §15). The page reads in `server/favorites/queries.ts` and `server/alerts/queries.ts` swallow a failed read into an empty list (issue #48), which shows "no favourites yet" to a user whose favourites exist.
- **Health.** There is no `/api/health` or `/api/health/db` (`STACK.md` §2).
- **CSP.** `next.config.ts` sends a static policy whose `script-src` allows `'unsafe-inline'`, so an injected inline script runs (`STACK.md` §11).

This is phase 6 of ADR 0007: rows 11–15.

## Acceptance criteria

`unit` means a Vitest test with no database or network; `node` means a `*.node.test.ts`; `e2e` means Playwright against a production build.

### Env

- [x] PLAT-1 · unit — `lib/env.ts` is built with `@t3-oss/env-nextjs` `createEnv`. It declares every variable the application reads, server-side ones under `server` and none under `client` except `NEXT_PUBLIC_SENTRY_DSN`. The required ones stay required: `DATABASE_URL` and `NEXTAUTH_SECRET`. Everything that is optional today stays optional.
- [x] PLAT-2 · unit — The module no longer imports `dotenv` and never calls `console`. The two production warnings it prints today (email not configured, two-factor not configured) become Pino `warn` logs emitted once, from `lib/logger.ts`, the first time the mailer or the two-factor setup runs without its variables.
- [x] PLAT-3 · unit — `next.config.ts` imports `lib/env.ts`, so `pnpm build` fails with the variable's name when a required variable is missing or malformed. `SKIP_ENV_VALIDATION=1` skips it, and only `pnpm lint` and CI's lint job set it.
- [x] PLAT-4 · unit — No file under `app/`, `components/`, `lib/`, `server/` or `proxy.ts`, nor `next.config.ts` or `instrumentation*.ts`, reads `process.env` except `lib/env.ts` and the literal `process.env.NEXT_RUNTIME` checks in `instrumentation.ts`, which Next.js only strips from the Edge bundle in that literal form. Tooling that runs outside Next — `prisma.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `scripts/**`, `e2e/**` — is exempt. A test reads the tree and fails on any other hit.
- [x] PLAT-5 · unit — `proxy.ts` reads `APP_URL`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` through `lib/env.ts`, which is Edge-safe because it no longer imports `dotenv` or `node:*`.

### Database

- [x] PLAT-6 · unit — `lib/db/prisma.ts` builds the client with `@prisma/adapter-neon` over the pooled `DATABASE_URL` when `VERCEL` is set, and with `@prisma/adapter-pg` otherwise. Nothing else instantiates `PrismaClient` or an adapter.
- [x] PLAT-7 · unit — The dev-reload cache on `globalThis` is typed with a `declare global` augmentation, without `as unknown as`, and is used only when `NODE_ENV` is not `production`. This closes issue #47.
- [x] PLAT-8 · unit — `DIRECT_URL` is an optional variable. `prisma.config.ts` gives Prisma's migration commands `DIRECT_URL` when it is set, and `DATABASE_URL` otherwise, so local work needs no second variable.
- [x] PLAT-9 · unit — `pnpm build` is `prisma generate && node scripts/migrate-deploy.mjs && next build`. The script runs `prisma migrate deploy` only when `VERCEL_ENV` is `production`. Otherwise it prints one line saying it skipped and exits 0. A failed migration exits non-zero and stops the build.

### Results and errors

- [x] PLAT-10 · unit — `lib/result.ts` exports `Result<T, E>`, `ok(value)` and `err(error)`. A failure's error is `{ code, messageKey }`, where `code` is the feature's code and `messageKey` is the `t.*` path that renders it (`"alertErrors.criteriaTooBroad"`). The type forces a caller to narrow on `ok` before it reads `value` or `error`.
- [x] PLAT-11 · node — Every Server Action in `server/alerts/`, `server/favorites/` and `server/locale/` returns a `Result`. Expected failures — unauthenticated, invalid input, a domain rule such as "criteria too broad" — return `err`. The auth features (`account`, `registration`, `password-reset`, `email-verification`, `two-factor`) keep `{ success, error }` until phase 11 (owner's decision, 2026-09-30).
- [x] PLAT-12 · node — Those actions no longer catch unexpected failures into an `unexpected` code. A database or programming error is thrown, reaches Sentry, and the calling hook shows the same generic toast the `unexpected` code shows today. The `unexpected` code is removed from `ALERT_ERROR` and `FAVORITE_ERROR` once nothing returns it.
- [x] PLAT-13 · unit — The forms and hooks that consume those actions read `error.messageKey` through a single `translateError(t, messageKey)` in `lib/i18n/errors.ts`, which falls back to a generic message for an unknown key. `translateAlertError` is removed. Favorites have no error namespace today, so `favoriteErrors` (`unauthenticated`, `invalidListing`) is added to both locales. `translateAuthError` stays for the auth features.
- [x] PLAT-14 · node + component — `server/favorites/queries.ts` and `server/alerts/queries.ts` no longer turn a failed read into an empty list. The error is thrown, and `/favorites`, `/alerts` and `/alerts/[id]` each gain an `error.tsx` that shows a translated message and a retry button that refreshes the route's server data and resets the boundary. This closes issue #48. The other routes' missing `loading.tsx`/`error.tsx` stay in issue #43.

### Logging, correlation and Sentry

- [x] PLAT-15 · unit — `lib/logger.ts` exports one Pino logger: JSON in production, `pino-pretty` in development, silent in tests. Its `redact` paths censor `password`, `*.password`, `token`, `*.token`, `email`, `*.email`, `secret`, `*.secret`, `code`, `*.code`, `headers.authorization` and `headers.cookie`.
- [x] PLAT-16 · unit — Every `console.*` call in `app/`, `components/`, `lib/` and `server/` is replaced by the logger, and Biome's `noConsole` rule is an error for those paths. `e2e/**` and `scripts/**` may keep `console`.
- [x] PLAT-17 · unit + node — `proxy.ts` gives every request it handles an `x-request-id`: it keeps a valid incoming one (a UUID) and otherwise generates one. It forwards the id to the app as a request header and returns it as a response header. `lib/request-context.ts` holds the id in an `AsyncLocalStorage`. Route handlers and the Server Actions from PLAT-11 run inside it, and every log line written inside it carries `requestId`.
- [x] PLAT-18 · unit — Sentry (`@sentry/nextjs`) is initialised from `instrumentation.ts` and `instrumentation-client.ts` only when a DSN is set, with `dataCollection` turning off user identity, cookies, headers, request bodies, query strings, query data and stack-frame variables (SDK 11's replacement for `sendDefaultPii: false`), `tracesSampleRate: 0` and no session replay. Without a DSN it is inert, and nothing is sent. Browser events go through a tunnel route (`/monitoring`), so the CSP needs no Sentry host. Source maps are uploaded only when `SENTRY_AUTH_TOKEN` is set. Every event carries a `request_id` tag when one is in context.

### Health

- [x] PLAT-19 · node — `GET /api/health` answers `200` with `{ "status": "ok" }` and never touches the database.
- [x] PLAT-20 · node — `GET /api/health/db` runs one `SELECT 1` through `server/health/service.ts` and answers `200` with `{ "status": "ok", "db": "ok" }`. When the query fails it answers `503` with `{ "status": "error", "db": "unreachable" }`, logs the failure and carries no error detail in the body. Both health routes send `Cache-Control: no-store`.

### Security headers

- [x] PLAT-21 · unit + e2e — `proxy.ts` sends the `Content-Security-Policy` header on every page response, with a fresh base64 nonce of at least 128 bits per request. `script-src` is `'self' 'nonce-<nonce>' 'strict-dynamic'`, plus `'unsafe-eval'` in development only; it has no `'unsafe-inline'`. Every other directive keeps its current value, including `style-src 'self' 'unsafe-inline'`.
- [x] PLAT-22 · unit — The proxy matcher replaces today's list of six gated paths and covers every page and API route and skips `_next/static`, `_next/image`, `favicon.ico`, the `/monitoring` tunnel and static files. The auth redirects keep applying only to the paths they apply to today.
- [x] PLAT-23 · e2e — The root layout passes the nonce to `ThemeProvider` (next-themes' inline script), and the pages load with no CSP violation in the console. The map, the theme toggle, login and the favorites page keep working.
- [x] PLAT-24 · unit — `next.config.ts` no longer sends a `Content-Security-Policy` header. It keeps the others, including `Strict-Transport-Security`, unchanged.
- [x] PLAT-25 · unit — ADR 0013 records that per-request nonces make every page dynamic, and what that costs: the static pages of the current build become dynamic, with no full-route cache and one proxy run per request.

### Docs

- [x] PLAT-26 · unit — `.env.example` lists `DIRECT_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and `SKIP_ENV_VALIDATION` with example values. `docs/privacy/processors.md` lists Sentry (EU region), what it receives and that `sendDefaultPii` is off. `docs/ARCHITECTURE.md` describes the env module, the adapters, the migration step, the logger, Sentry, health and the CSP. ADR 0007 marks rows 11–15 resolved.

## Worked examples

- **PLAT-3**, `DATABASE_URL` unset, `pnpm build` → fails before `next build` compiles, and the output names `DATABASE_URL`.
- **PLAT-6**:

  | `VERCEL` | Adapter | URL |
  | --- | --- | --- |
  | `"1"` | `PrismaNeon` | `DATABASE_URL` (pooled, `-pooler` host) |
  | unset | `PrismaPg` | `DATABASE_URL` |

- **PLAT-8**:
  - `DIRECT_URL=postgres://a`, `DATABASE_URL=postgres://b` → migrations use `postgres://a`.
  - `DIRECT_URL` unset, `DATABASE_URL=postgres://b` → migrations use `postgres://b`.
- **PLAT-9**:

  | `VERCEL_ENV` | `prisma migrate deploy` | Exit |
  | --- | --- | --- |
  | `production` | runs | its exit code |
  | `preview` | skipped | 0 |
  | unset (local) | skipped | 0 |

- **PLAT-10**:
  - `ok(3)` → `{ ok: true, value: 3 }`.
  - `err({ code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" })` → `{ ok: false, error: { code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" } }`.
- **PLAT-11**:
  - `saveFavorite(listing)` signed out → `{ ok: false, error: { code: "unauthenticated", messageKey: "favoriteErrors.unauthenticated" } }`.
  - `saveFavorite({ ...listing, source: "eBay" })` signed in → `{ ok: false, error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" } }`.
  - `saveFavorite(listing)` signed in, the database up → `{ ok: true, value: undefined }`.
- **PLAT-11**, `setLocale("xx")` → `{ ok: false, error: { code: "invalidLocale", messageKey: "localeErrors.invalidLocale" } }`. Today it reuses `ALERT_ERROR.invalidCriteria`; `localeErrors.invalidLocale` is added to both locales.
- **PLAT-12**, `saveFavorite(listing)` signed in, Prisma throws → the action rejects, Sentry receives the error, the toast reads the generic `unexpected` copy.
- **PLAT-13**:
  - `translateError(t, "alertErrors.criteriaTooBroad")` → the `alertErrors.criteriaTooBroad` copy.
  - `translateError(t, "alertErrors.nope")` → the generic fallback, in English "Something went wrong. Please try again." (the current `alertErrors.unexpected` copy).
- **PLAT-15**, `logger.info({ user: { email: "ana@example.test" }, token: "abc" }, "x")` → the line carries `"email":"[Redacted]"` and `"token":"[Redacted]"`.
- **PLAT-17**:
  - Request with `x-request-id: 0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d` → the response carries the same id.
  - Request with `x-request-id: hello` or none → the response carries a newly generated UUID.
- **PLAT-19**, `GET /api/health` with the database down → `200 {"status":"ok"}`.
- **PLAT-20**, `GET /api/health/db`:
  - database up → `200 {"status":"ok","db":"ok"}`;
  - `$queryRaw` throws → `503 {"status":"error","db":"unreachable"}`.
- **PLAT-21**, nonce `r4nd0m`, production → `script-src 'self' 'nonce-r4nd0m' 'strict-dynamic'`; two requests → two different nonces.

## Data model

No change. No migration.

## Permissions

- The health routes are public and return no data beyond the status fields.
- The actions keep their current authentication checks. Only the return shape changes.

## Edge cases

- **The Edge runtime.** `proxy.ts` runs on the Edge, so `lib/env.ts` must not import Node-only modules, and the correlation id travels as a header. `AsyncLocalStorage` is only used on the Node side.
- **A request that bypasses the proxy** (a static asset, the Sentry tunnel) has no `x-request-id`. `lib/request-context.ts` then returns `undefined`, and the log line carries no `requestId`.
- **A preview deploy with a pending migration** runs the new code against the production schema without migrating it, as today. Previews get their own database in phase 12.
- **Sentry without a DSN**, locally and in tests, sends nothing and logs nothing about it.
- **A spoofed `x-request-id`** that is not a UUID is replaced, so a client cannot inject arbitrary text into the logs.
- **Tests.** The logger is silent under Vitest, and Sentry is never initialised there.

## Out of scope

- **The auth features' `Result`** — `account`, `registration`, `password-reset`, `email-verification`, `two-factor` and the `AUTH_ERROR` codes — stay until phase 11 (row 25).
- **Migrations on previews and a staging database**: phase 12.
- **`loading.tsx`/`error.tsx` on the routes other than PLAT-14's**: issue #43.
- **Zod on the remaining action inputs**: issue #44.
- **Sentry tracing, profiling and session replay.** The free plan's quota goes to errors.
- **Removing `'unsafe-inline'` from `style-src`.** Leaflet and Motion set inline styles.
- **Rate-limiting the health routes.** They do no work beyond one `SELECT 1`.

## Contracts

- **New dependencies**, all named in `STACK.md` §1: `@t3-oss/env-nextjs`, `@prisma/adapter-neon`, `pino`, `pino-pretty` (dev), `@sentry/nextjs`. `dotenv` is removed from `lib/env.ts` but stays for the tooling configs.
- **Scripts.** `build` gains `node scripts/migrate-deploy.mjs`, and `lint` runs with `SKIP_ENV_VALIDATION=1` through `cross-env`. This approved spec authorises the `package.json` and Biome changes (`RULES.md` §1).
- **Raw SQL.** `SELECT 1` in `server/health/service.ts` is the only raw query, and this approved spec authorises it (`RULES.md` §11).
- **Headers.** `x-request-id` on every proxied response. `Content-Security-Policy` moves from `next.config.ts` to `proxy.ts`.

## Decisions and rationale

### Migrations run in the production build only (owner's decision, 2026-09-30)

Previews share the production database until phase 12, so migrating from a preview build would apply an unmerged schema to production. The build migrates only when `VERCEL_ENV` is `production`. A preview with a pending migration behaves as today. ADR 0013 records it.

### Sentry is wired but inert until the DSN exists (owner's decision, 2026-09-30)

The code ships ready, with `sendDefaultPii: false`. Nothing is sent until the owner creates the sentry.io project in the EU region and sets the DSN in Vercel. That is a manual step, listed in the PR.

### `Result` for every feature except auth (owner's decision, 2026-09-30)

The auth flows are rewritten in phase 11 on Better Auth, so converting their return shape now would be thrown away. `server/rate-limit/` has no Server Action and returns domain values rather than failures, so it has nothing to convert.

### CSP nonces, with the dynamic rendering they cost (owner's decision, 2026-09-30)

A nonce must be fresh per response, so no page can be pre-rendered. Every page already depends on the session or the search state, so the cost is mostly the landing and legal pages. ADR 0013 records the trade.

### Page reads fail loudly

Phase 5 kept the empty list on a failed read until this phase (`core-layout.md`). With Sentry and an error boundary in place, a failed read now shows an error with a retry instead of a false "nothing saved".
