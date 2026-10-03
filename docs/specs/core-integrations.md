# Integrations: rate limiting, background work and email (migration phase 10)

Key: INT
Status: Implemented
Last updated: 2026-10-02

---

## Problem

Three integrations predate the core (`docs/decisions/0007-adopt-core-rules.md` rows 22–24):

- **Rate limiting** lives in a Postgres table (`RateLimit`, ADR 0005).
  - Every login, registration, reset, two-factor and search attempt writes a database row.
  - Previews share production's database, and so share its limits.
  - Phase 11's Better Auth expects Redis for its own limits (`STACK.md` §10, `RULES.md` §16).
- **The alert queue is drained by a GitHub Actions cron** every five minutes (ADR 0006).
  - GitHub delays scheduled workflows under load.
  - GitHub disables them after 60 days without repository activity.
  - The core uses QStash for scheduled and deferred work and `after()` for post-response work (`STACK.md` §13).
- **Email** is sent with a hand-written `fetch` to Resend's API, from string templates in `lib/email/templates/*`. The core uses the `resend` SDK and react-email (`STACK.md` §1).

This is phase 10 of ADR 0007: rows 22, 23 and 24.

## Acceptance criteria

`unit` means a Vitest test with no database; `node` means a `*.node.test.ts` or `*.integration.test.ts`; `e2e` means Playwright.

### Rate limiting

- [x] INT-1 · node — `lib/platform/rate-limit.ts` is the only module that imports `@upstash/ratelimit` or `@upstash/redis`.
  - It exposes `consume(key, rule)`, `peek(key, rule)` and `reset(key)` with the same results `server/rate-limit/service.ts` returns today (`allowed`, `retryAfterMs`).
  - It uses a sliding window per rule.
  - `server/rate-limit/service.ts` keeps its public API and every existing `RATE_LIMITS` value, and calls the adapter instead of Prisma.
- [x] INT-2 · node — Every key carries an environment prefix: `production:`, `preview:` or `development:`, from `VERCEL_ENV`, with `development` as the fallback. Previews and e2e never consume production's limits.
- [x] INT-3 · node — An email in a key is never sent to Upstash in clear: `login:email:<sha256(lowercased email)>`. IPs are sent as they are, because a limit per IP needs the IP.
- [x] INT-4 · node — When Redis is unreachable, `consume` fails open: it allows the request and logs a `warn` with the rule name, never the key. This matches today's Postgres behaviour.
- [x] INT-5 · node — Local development, e2e and the integration tests do not need Upstash. Without the `UPSTASH_*` variables, rate limiting is disabled with one warning; production and preview builds fail without them. The service's rate-limit tests inject an in-memory sliding-window fake, because `@upstash/ratelimit`'s scripts use an Upstash-only Redis flag that a local Redis rejects.
- [x] INT-6 · unit — No code reads or writes the `RateLimit` table any more.
  - The model and the table stay until a later PR drops them (expand/contract, `RULES.md` §11). The ADR names that follow-up, and an issue tracks it.
  - The opportunistic prune of `RateLimit` rows is removed.

### Background work

- [x] INT-7 · node — `POST /api/alerts/run` accepts only requests signed by QStash, verified with `@upstash/qstash`'s `Receiver` against `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. An unsigned or wrongly signed request gets `401`, and nothing runs. The `ALERTS_CRON_SECRET` bearer check is removed.
- [x] INT-8 · unit — `scripts/qstash-schedule.mjs` creates or updates one QStash schedule that calls `POST <APP_URL>/api/alerts/run` every five minutes (`*/5 * * * *`) with 3 retries. Run twice, it leaves exactly one schedule. It reads `QSTASH_TOKEN` and `APP_URL` from the environment and refuses to run without them.
- [x] INT-9 · unit — `.github/workflows/alerts.yml` is deleted, and nothing in the repository references `ALERTS_CRON_SECRET`.
- [x] INT-10 · node — Post-response housekeeping runs inside `after()` from `next/server`, so it never delays a response:
  - the opportunistic prune of expired auth rows;
  - the soft-delete purge (DATA-12).

  A failure inside `after()` is logged and reported to Sentry, never thrown to the user.
- [x] INT-11 · node — The alert runner's behaviour is unchanged: ALERT-1..42 pass with only the request-signing setup changed in their tests.

### Email

- [x] INT-12 · node — `lib/platform/email.ts` is the only module that imports `resend`. It sends through the SDK's `emails.send`.
  - When `RESEND_API_KEY` or `EMAIL_FROM` is missing, it no-ops and logs once, as today (PLAT-2).
  - A Resend error is logged with its name and status, never the recipient, and returned as a failed send.
- [x] INT-13 · node — Every email is a react-email component in `emails/`, rendered with `@react-email/render` to HTML and to plain text: verification, password reset, email change, the security notices and the alert digest.
  - Each email's subject, every link (URL and anchor text), and the copy in both locales are the same as today's string templates produce.
  - Each email's test asserts those values, hand-copied from today's output.
- [x] INT-14 · e2e — Every email renders correctly: a script renders each template to HTML in both locales, and Playwright screenshots them at desktop and mobile widths. The owner confirms the screenshots before the commit (`RULES.md` §22 item 5).
- [x] INT-15 · unit — `lib/email/templates/*` and the hand-written `fetch` client are deleted. `DESIGN.md` › Email describes the react-email components instead of the string layout.

### Docs

- [x] INT-16 · unit — The docs record the change:
  - ADR 0017 records Upstash Redis for rate limiting, QStash plus `after()`, and react-email with the Resend SDK. It marks ADRs 0005 and 0006 superseded.
  - `docs/privacy/processors.md` adds Upstash (EU, Frankfurt): it receives IPs and hashed emails in rate-limit keys for at most the longest window, and nothing for QStash beyond the schedule.
  - `docs/ARCHITECTURE.md` describes all three.
  - `.env.example` gains the new variables.
  - ADR 0007 rows 22, 23 and 24 end `Resolved in phase 10`.

## Worked examples

- **INT-2**: `VERCEL_ENV=preview`, `register:ip:203.0.113.7` → Redis key `preview:register:ip:203.0.113.7`.
- **INT-3**: `login:email:Ana@Example.com` → `login:email:` followed by the sha256 hex of `ana@example.com`.
- **INT-4**: Redis down, a login attempt → allowed, with one `warn` log `{ rule: "loginPerIp" }`.
- **INT-7**:
  - a request with no `Upstash-Signature` → `401`, and the runner does not run;
  - a valid signature → `200` with the run summary.
- **INT-8**: `QSTASH_TOKEN` unset → exits 1 with "QSTASH_TOKEN is required".
- **INT-13**: the Spanish password-reset email has today's subject, and its button links to `<APP_URL>/reset-password?token=<token>`, the same URL and anchor text as today.

## Data model

No schema change. The `RateLimit` table becomes unused, and a later PR drops it.

## Permissions

`/api/alerts/run` is callable only by QStash: it verifies the signature, and needs no user session. Every other permission is unchanged.

## Edge cases

- **The first deploy, before the schedule exists.** Alerts pause until the owner runs `scripts/qstash-schedule.mjs` against production. The queue keeps its jobs and drains on the first run.
- **Signing key rotation.** `Receiver` accepts the current and the next key, so a rotation in the Upstash console needs no deploy.
- **Rate-limit counters at cutover.** Counters in the old table are not migrated: every limit starts fresh once, which is harmless for windows of at most one hour.
- **Email clients.** react-email's output keeps table-based layout and inline styles, so the clients that render today's emails still render them.

## Out of scope

- **Dropping the `RateLimit` table**: a later PR, to keep the migration compatible.
- **Better Auth's own rate limiting**: phase 11. It will reuse the same Redis.
- **Moving other periodic work to QStash.** Nothing else is scheduled today.

## Contracts

- **New dependencies**, all named in `STACK.md` §1:
  - `@upstash/ratelimit`, `@upstash/redis`, `@upstash/qstash`, `resend`, `@react-email/components`, `@react-email/render`.
  - No local container image: `@upstash/ratelimit`'s Lua scripts use an Upstash-only Redis flag a local Redis rejects (INT-5 above).
- **New env vars**:
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`;
  - `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.
- **Removed env var**: `ALERTS_CRON_SECRET`.
- **Owner's manual actions**, all listed in the PR:
  1. Create an Upstash Redis database in the EU (Frankfurt) region.
  2. Set the five variables in Vercel, Production and Preview, and delete `ALERTS_CRON_SECRET` from Vercel and from GitHub's secrets.
  3. After the deploy, run `scripts/qstash-schedule.mjs` once.
- **Personal data.** Upstash becomes a processor, with IPs and hashed emails (`RULES.md` §12). This approved spec authorises it.

## Decisions and rationale

### Upstash Redis for rate limiting (owner's decision, 2026-10-02)

It takes every limit write off the database and separates previews from production. Phase 11 needs it anyway.

### QStash for the alert schedule (owner's decision, 2026-10-02)

GitHub's scheduled workflows are best-effort, and are disabled after 60 days of repository inactivity. QStash delivers on schedule, with retries and a signature.

### react-email and the Resend SDK (owner's decision, 2026-10-02)

Emails become components that can be previewed, tested and kept consistent. The SDK replaces a hand-maintained API contract.

### Emails are hashed in rate-limit keys

A per-email limit only needs a stable identifier, not the address. Hashing keeps a personal field away from the new processor.
