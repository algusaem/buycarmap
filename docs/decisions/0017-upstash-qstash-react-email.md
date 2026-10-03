# 0017 — Upstash Redis, QStash and react-email

Status: Accepted · Date: 2026-10-03 · Resolves ADR 0007 rows 22, 23 and 24

## Context

[ADR 0007](0007-adopt-core-rules.md) named three deviations phase 10 closes:

- **Rate limiting** lived in a Postgres table ([0005](0005-postgres-rate-limiting.md)).
  Every login, registration, reset, two-factor and search attempt wrote a
  database row, and Vercel previews shared production's database — and so its
  limits. Phase 11's Better Auth expects Redis for its own limits (`STACK.md`
  §10, `RULES.md` §16).
- **The alert queue was drained by a GitHub Actions cron** every five minutes
  ([0006](0006-alert-scheduling.md)). GitHub delays scheduled workflows under
  load and disables them after 60 days without repository activity. The core
  uses QStash for scheduled and deferred work, and `after()` for post-response
  work (`STACK.md` §13).
- **Email was sent with a hand-written `fetch`** to Resend's API, from string
  templates in `lib/email/templates/*`. The core uses the `resend` SDK and
  react-email (`STACK.md` §1).

[`docs/specs/core-integrations.md`](../specs/core-integrations.md) (INT-1 through
INT-16) is the spec; this records the decisions behind it.

## Decided

### Upstash Redis for rate limiting

Every limit write moves off the database and previews stop sharing production's
budget. `lib/platform/rate-limit.ts` is the only module that imports
`@upstash/ratelimit` or `@upstash/redis` — a sliding window per rule, built
with `Ratelimit.slidingWindow(limit, "<windowMs> ms")`. `server/rate-limit/service.ts`
keeps its public API (`consumeRateLimit`, `isRateLimited`, `resetRateLimit`,
`RATE_LIMITS`) and every rule's values unchanged, calling the adapter instead
of Prisma; every `RateLimit` rule gets a `name` equal to its key, so a failed
consume can log which rule tripped without ever logging the key.

**Environment prefixes.** Every Redis key is prefixed `production:`,
`preview:` or `development:`, read live from `VERCEL_ENV` (falling back to
`development`) rather than through `lib/env.ts`'s cached `env` — the same
reasoning `isDevelopmentRuntime()` there already uses, and the reason a test
`vi.stubEnv`ing `VERCEL_ENV` per case can actually observe the change.

**Email hashing.** A `:email:<value>` segment in a key becomes the sha256 hex
of the lowercased address before it reaches Redis — a per-email limit only
needs a stable identifier, not the address, and hashing keeps a personal field
away from the new processor (`docs/privacy/processors.md`). An IP segment is
sent as-is, because a per-IP limit needs the IP.

**Fail open.** On any Redis error, `consume`/`peek` allow the request and log
a `warn` naming the rule, never the key — matching the Postgres version's
behaviour and the same reasoning [0005](0005-postgres-rate-limiting.md) gave:
a limiter that hard-fails the request when the store hiccups turns a transient
outage into a total auth outage.

**The `RateLimit` table stays unused rather than dropped now** (expand/contract,
`RULES.md` §11) — [issue #59](https://github.com/algusaem/buycarmap/issues/59)
tracks dropping it in a later migration, once no deployed code references the
model.

### No local Redis — rate limiting disables itself instead

A local Redis was tried first (`redis:7-alpine` plus `hiett/serverless-redis-http`
in front of it, the pair Upstash's own docs recommend for local development
against the real `@upstash/redis` REST client) and found incompatible:
`@upstash/ratelimit`'s Lua scripts (every algorithm, every version checked)
carry a `#!lua flags=allow-key-locking` library attribute that is an
Upstash-proprietary extension to their own forked Redis — verified directly
against real Redis 7.4.11, which refuses it outright (`ERR Invalid metadata
value given: flags=allow-key-locking`, confirmed both through the SDK and
`redis-cli FUNCTION LOAD` directly). The adapter is correct as specified and
works against the real Upstash service; it cannot exercise the real
sliding-window algorithm against any self-hosted Redis, local or otherwise.

Rather than keep a local Redis that only ever exercised the fail-open path,
`lib/platform/rate-limit.ts` disables rate limiting outright when
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are absent: `consume`/`peek`
allow every request and `reset` no-ops, logging one `warn` per process rather
than one per request. `lib/env.ts` requires both variables when `VERCEL_ENV`
is `production` or `preview`, so a deploy without them fails the build
instead of silently shipping with rate limiting off. Local development, e2e
and the integration tests run with no `UPSTASH_*` variables at all — there is
no `redis`/`redis-http` service in `docker-compose.yml` or
`test/integration.global-setup.ts` any more.

`lib/platform/rate-limit.ts`'s `consume`/`peek`/`reset` take an optional
`redis`/`limiterFactory` pair (the real `Ratelimit` by default), so
`server/rate-limit/service.integration.test.ts` can inject
`test/fakes/ratelimit.ts` — an in-memory sliding window over a shared store —
and exercise the real limiting math (remaining budget, retry wait, reset)
without reaching any Redis at all. This replaces the local-Redis setup's
"the existing tests still pass, but nothing proves the real algorithm runs"
gap: the fake *is* the sliding-window algorithm under test, not a stand-in
for Upstash's network behaviour.

### QStash plus `after()` for background work

`lib/platform/qstash.ts`'s `verifyQstashSignature` uses `@upstash/qstash`'s
`Receiver` against the `Upstash-Signature` header and
`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` — accepting both lets a
key rotation in the Upstash console skip a deploy. `POST /api/alerts/run`
checks this instead of the `ALERTS_CRON_SECRET` bearer token; an unsigned or
wrongly signed request gets `401` and nothing runs.

`scripts/qstash-schedule.mjs` creates or updates the one schedule that calls
it every five minutes, 3 retries — run twice, it leaves exactly one. The owner
runs `pnpm qstash:schedule` once after the five Upstash/QStash variables are
set in Vercel and the app is deployed; `.github/workflows/alerts.yml` and
every reference to `ALERTS_CRON_SECRET` are deleted.

**Post-response housekeeping moves inside `after()`.** The opportunistic
auth-token prune and the DATA-12 soft-delete purge
(`server/auth/service.ts`'s `maybePruneExpiredAuthRows`) register their work
with `after()` from `next/server` instead of awaiting it inline, so neither
ever delays the response that happened to trigger it. The callback is wrapped
in its own try/catch: a failure is logged and reported to Sentry, never
rethrown — there is no request left to fail by the time it runs.

`after()` throws when called outside a request scope (a script, or a test
calling the function directly, with no Next.js request in flight — confirmed
by reading `next/dist/server/after/after.js`). `maybePruneExpiredAuthRows`
catches that and falls back to running the housekeeping inline, so a caller
with no request context does not silently lose it. This is **not a scheduler**
— the pruning is still opportunistic, on roughly 2% of calls that already
write a token row; `CLAUDE.md` › Authentication's "do not add a scheduler"
still holds, now with the deferred execution happening after the response
instead of before it.

### react-email and the Resend SDK

`lib/platform/email.ts` is the only module that imports `resend`; `sendEmail`
calls `new Resend(key).emails.send(...)` and keeps today's no-op-when-
unconfigured and warn-once behaviour (PLAT-2, `docs/specs/core-platform.md`).
A Resend error is logged with its name and status, never the recipient, and
reported as a failed send rather than thrown — callers in enumeration-
sensitive flows (registration, password reset) keep ignoring the result the
same way.

Every email is a component in `emails/*.tsx`, built from
`@react-email/components` and rendered to HTML and plain text with
`@react-email/render` (`emails/render.ts`). `emails/components.tsx` holds the
shared chrome — `EmailLayout`, `Paragraph`, `EmailButton`, `RawLink` and
friends — reproducing `lib/email/templates/layout.ts`'s styling (Helvetica/Arial
stack, `#F5F5F4` body, white 12px-radius card, the amber button) as inline
styles on react-email primitives instead of hand-built HTML strings. Copy
moves into `messages/{en,es}.json`'s new `transactionalEmail` namespace (the
alert digest already used `alerts.email`), read through `createTranslator` —
next-intl's standalone entry point, since no request is in flight when a cron
sends mail — exactly as the alert digest already did. `lib/email/templates/*`,
`lib/email/client.ts` and the now-orphaned `lib/email/copy.ts` are deleted;
every criterion test they carried that still applies (`PLAT-2`, `ALERT-22`,
`ALERT-32`) was already covered elsewhere or was moved under the same id into
`emails/emails.node.test.ts` — `pnpm spec:check` confirms nothing was orphaned.

`scripts/render-emails.ts` renders every template, in both locales, to static
HTML for `e2e/emails.spec.ts` to screenshot at desktop and mobile widths,
gated behind `SCREENSHOTS=1` like `e2e/screenshots.spec.ts` — the owner
reviews those before an email-copy or layout change ships (`RULES.md` §22
item 5).

## What it beat

**Self-hosting Redis permanently**, rejected for the same reason considered
and rejected in [0005](0005-postgres-rate-limiting.md): it adds a service,
credentials and a second failure mode. The difference is phase 11 needs Redis
regardless, so the service is being added either way — this just adds it now,
for rate limiting too, rather than twice.

**Keeping the GitHub Actions cron and layering QStash only for something
else.** Running two schedulers would be strictly worse than the one GitHub
cron it replaces.

**A hand-rolled email templating layer kept forever**, rejected because the
core's react-email + Resend SDK pattern is what phase 11 and beyond will
build on, and maintaining a parallel string-template system alongside it
would be the kind of deviation this migration exists to close.

## What it costs

- **The owner's manual actions** (all in the PR): create an Upstash Redis
  database in the EU (Frankfurt) region; set the five new variables in
  Vercel (Production and Preview) and delete `ALERTS_CRON_SECRET` from
  Vercel and GitHub's secrets; run `pnpm qstash:schedule` once after deploy.
- **Rate-limit counters do not migrate at cutover.** Every limit starts fresh
  once, harmless for windows of at most one hour.
- **The fake in `test/fakes/ratelimit.ts` proves the sliding-window math,
  not Upstash's own network behaviour** — the real `@upstash/redis`/
  `@upstash/ratelimit` wiring is only exercised by the real Upstash service,
  which nothing in CI reaches.
- **A production or preview deploy with no Upstash configured now fails the
  build** (`lib/env.ts`), where it previously would have shipped with rate
  limiting silently disabled.

## What would change our mind

- **Upstash Redis's free tier limits becoming a real constraint** at this
  traffic — would argue for self-hosting after all, now that the sliding-
  window-script incompatibility above is known going in.
- **QStash's delivery guarantees proving insufficient** in practice — would
  reopen the scheduler choice [0006](0006-alert-scheduling.md) already
  surveyed.

## See also

- [docs/specs/core-integrations.md](../specs/core-integrations.md) — INT-1 through INT-16
- [ARCHITECTURE.md › Rate limiting](../ARCHITECTURE.md#rate-limiting), [› Background work (alerts)](../ARCHITECTURE.md#background-work-alerts), [› Email](../ARCHITECTURE.md#email)
- [docs/privacy/processors.md](../privacy/processors.md) — the Upstash row
- [0005](0005-postgres-rate-limiting.md), [0006](0006-alert-scheduling.md) — superseded by this ADR
- [issue #59](https://github.com/algusaem/buycarmap/issues/59) — dropping the `RateLimit` table
