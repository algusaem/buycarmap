# Operations

Deploying, configuring and fixing this in production.

## Deployment

Vercel. `pnpm build` runs `prisma generate && next build`, so the client is
generated during the build — there is nothing to commit or cache.

Migrations are **not** applied by the build. Run `prisma migrate deploy` against
the production database as a deliberate step.

### Security headers

Set in [`next.config.ts`](../next.config.ts) for every route: CSP,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` and
two-year HSTS with preload.

**`script-src` allows `'unsafe-inline'`, deliberately.** The App Router injects
inline bootstrap scripts, and the alternative — per-request nonces via middleware
— forces every page to render dynamically, costing the app its static
optimisation. The high-value directives are still enforced: `frame-ancestors`,
`object-src`, `base-uri` and `form-action` are what block clickjacking, plugin
injection and form exfiltration.

Two hosts are allowed, and both trace to a real browser-side dependency:
`*.basemaps.cartocdn.com` for map tiles (`img-src`) and
`nominatim.openstreetmap.org` for geocoding (`connect-src`). Listing photos are
*not* listed because `next/image` proxies them through `/_next/image` on this
origin.

`geolocation=(self)` must stay — the map asks for the user's position.

### Image hosts

`next.config.ts` allows `**.wallapop.com`, `**.ccdn.es`, `**.milanuncios.com` and
`images.unsplash.com`. **A new source needs its CDN added here**, or `next/image`
throws at runtime rather than degrading.

## Environment variables

Required — validated by [`lib/env.ts`](../lib/env.ts) at import, which throws at
boot rather than failing later:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon connection string for the `@prisma/adapter-pg` adapter |
| `NEXTAUTH_SECRET` | Signs every session JWT. `openssl rand -base64 32`. Under 32 chars logs a warning. **Rotating it signs everyone out** |

Optional — each disables a feature rather than blocking startup:

| Variable | Absent means |
| --- | --- |
| `NEXTAUTH_URL` | Also decides `useSecureCookies`. Must be `https://` in production or session cookies ship without the Secure flag |
| `RESEND_API_KEY` + `EMAIL_FROM` | Mailer no-ops. Registration falls back to immediate account creation, **which leaks whether an address is registered** |
| `APP_URL` | Falls back to `NEXTAUTH_URL` → `https://$VERCEL_URL` → `http://localhost:3000`. Only set it when the canonical domain differs from `NEXTAUTH_URL` |
| `TWO_FACTOR_ENCRYPTION_KEY` | Two-factor is hidden and enrolment refused. **Changing it makes every existing enrolment unreadable** |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google button does not render |
| `GITHUB_ID` + `GITHUB_SECRET` | GitHub button does not render |
| `ALERTS_CRON_SECRET` | The alert run endpoint refuses every request, so alerts never fire. Must match the GitHub repository secret of the same name |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | Tooling only, never read by the app. `pnpm db:branch` cannot run |

`.env.example` carries the reasoning next to each entry.

**On Vercel previews, leave `APP_URL` unset** so the `VERCEL_URL` fallback makes
each deployment link to itself rather than to production.

## Neon branch lifecycle

Each git branch gets its own copy-on-write database.

```bash
pnpm db:branch        # create or reuse, and write DATABASE_URL into this worktree's .env
pnpm db:branch:rm     # delete this branch's Neon branch
pnpm db:branch:rm --delete <name>
```

`db:branch` forks from the project's **default** Neon branch, waits for the
compute endpoint to finish provisioning (without the wait, the connection string
it hands back can refuse the first connection and look like a broken script),
then writes `DATABASE_URL` into the worktree's `.env` — seeding the rest of the
file from the main checkout so every other secret comes across.

After provisioning, bring the new database up to date:

```bash
pnpm exec prisma migrate deploy
```

Three refusals are built into the delete path, and all three are load-bearing:
it will not delete the Neon **default** branch, will not delete a branch the main
checkout's `DATABASE_URL` still points at, and will not delete one that does not
exist.

**Branches cost money and quota.** Delete them when the work merges.

## CI

[`.github/workflows/test.yml`](../.github/workflows/test.yml).

| Job | Runs on | Does |
| --- | --- | --- |
| `check` | push to master, pull requests | `prisma generate` → `pnpm check`: lint → typecheck → test → build |
| `gitleaks` | push to master, pull requests | gitleaks over the pushed commits |
| `e2e` | pull requests only | `prisma generate` → Playwright, chromium, no retries; uploads the report as an artifact |
| `contract-live` | nightly cron (04:00 UTC) | `test:contract:live` against the real upstream APIs |

[`.github/workflows/alerts.yml`](../.github/workflows/alerts.yml) is not a test
job — it is production scheduling. See [Alerts](#alerts) below.

[`.github/workflows/pr-title.yml`](../.github/workflows/pr-title.yml) checks that the pull request
title is a Conventional Commit — it becomes the squash commit on master.
[`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml) opens and updates
the release PR on every push to master; merging it tags the release and writes `CHANGELOG.md`,
which is never edited by hand. Renovate (`renovate.json`) proposes dependency updates once the
Renovate GitHub app is installed on the repository.

`pnpm check` stops at the first failing stage, and its static checks come first because they fail
in seconds. `prisma generate` runs before it because `typecheck` and the tests import the
generated client.

CI env vars are dummies — nothing connects to a real database or signs a real
token. The secret is padded past 32 characters only to keep the length warning
out of the logs.

**`pnpm test:e2e:db` is not in CI.** See [testing.md](testing.md#the-database-backed-suite).

**Branch protection on `master`**: the `Check`, `Secrets (gitleaks)`, `End-to-end (Playwright)` and
`Conventional Commits title` checks green, as [specs/core-tooling.md](specs/core-tooling.md) §4
records. `.github/CODEOWNERS` requests the owner's review on every pull request, and
`.github/pull_request_template.md` is the description `/check-pr` fills in.

## Alerts

Saved searches are polled by [`.github/workflows/alerts.yml`](../.github/workflows/alerts.yml)
on `*/5 * * * *`, a matrix of jobs each POSTing to `/api/alerts/run` with
`ALERTS_CRON_SECRET`. Why a GitHub cron rather than Vercel Cron, pg_cron or an
in-process timer: [`decisions/0006-alert-scheduling.md`](decisions/0006-alert-scheduling.md).
Behaviour: [`specs/alerts.md`](specs/alerts.md).

**Two repository secrets are required**, and neither is the Vercel env var:
`ALERTS_CRON_SECRET` (matching the deployment's) and `APP_URL`. With either
missing the workflow exits 0 with a message rather than failing — a red cron
every five minutes would train everyone to ignore it.

**The run's response is the instrument.** Read it before anything else:

| Field | Means |
| --- | --- |
| `intervalMs` | The cadence in force. Above 300000 the criteria count has pushed past the request ceiling and every alert is being polled less often |
| `oldestPendingAgeMs` | How stale the worst-off criteria set is. The freshness target is ten minutes end to end; sustained values above that mean the lap is not keeping up |
| `unhealthySources` | Sources returning nothing for three consecutive runs — the silent-death signal |
| `skippedNoEmail` | Matches found but not sent, because the mailer is unconfigured |
| `failures` | Per-criteria poll errors, with the upstream message |

**Scheduled runs drift.** GitHub delays schedules under load, sometimes by
several minutes, so the cadence is approximate. Judge health by
`oldestPendingAgeMs`, not by wall-clock spacing between runs.

**GitHub disables scheduled workflows after 60 days of repository inactivity.**
If alerts stop entirely and the endpoint answers fine by hand, check that first.

### Alerts stopped arriving

1. `curl -X POST -H "Authorization: Bearer $ALERTS_CRON_SECRET" $APP_URL/api/alerts/run`.
   A 401 means the secret differs between Vercel and GitHub.
2. Check `skippedNoEmail`. Non-zero means matches are being found and the mailer
   is unconfigured — see the Resend runbook below.
3. Check `unhealthySources`. A source listed there has returned nothing for
   three runs, which for Milanuncios usually means the parser broke rather than
   that there is nothing new.
4. Check the workflow's run history for the 60-day disable.

### Alerts are late

`oldestPendingAgeMs` climbing while `intervalMs` stays at 300000 means the drain
is the bottleneck, not the cadence: raise the matrix size in `alerts.yml`. Each
leg drains its own slice, so more legs is the lever.

`intervalMs` above 300000 means the criteria count has outgrown the 60 req/min
ceiling and everything is polled less often. That number is a guess documented
in the spec's open questions — raise it only while watching the nightly
`contract-live` job, which is the alarm for a source refusing traffic.

### A duplicate alert email went out

The queue is claimed with `FOR UPDATE SKIP LOCKED` and `AlertMatch` has a unique
index on `(alertId, listingId)`, so this should be impossible. If it happens,
the second guard failed too — check the migration actually created that index
before looking at application code.

## Runbooks

### A source returns nothing

The nightly `contract-live` job is the alarm. Check it first — if it is red, the
upstream changed shape.

1. Identify which source. `useListingsSearch` uses `Promise.allSettled`, so one
   source dying is invisible in the UI beyond fewer results.
2. Run `pnpm test:contract:live` locally to see the schema failure.
3. Fix the normalizer and the fixture together, and update the relevant page in
   [`integrations/`](integrations/wallapop.md).

**Milanuncios fails differently.** A parse failure returns zero ads rather than
an error, so *quietly empty* and *no matches* look identical. If Milanuncios
alone is empty, suspect the scrape before you suspect the filters —
[integrations/milanuncios.md](integrations/milanuncios.md).

### Registration or password reset emails never arrive

1. Check the boot logs. `lib/env.ts` warns loudly if `EMAIL_FROM` uses Resend's
   sandbox sender (`resend.dev`) in production — that only delivers to your own
   Resend account address, so **every other user is told to check an inbox that
   receives nothing** and can never finish signing up.
2. Verify a domain at `resend.com/domains` and use an address on it.
3. If email is deliberately unconfigured, registration falls back to immediate
   account creation — which reports `emailTaken` and therefore leaks account
   existence. Configuring Resend closes that.

### Signups are being rejected

The Have I Been Pwned check **fails open** — a network failure or HIBP outage
lets the password through rather than blocking registration. So an outage there
is not the cause. Look at the length rule (12–72; 72 is bcrypt's truncation
limit) and the strength scorer, which rejects below 2 of 4.

The rate limiter also fails open on a database error, so it is not the cause
either.

### Someone is locked out

Login is limited per IP (20 / 15 min) and per account (8 failures / 15 min,
cleared on success). Both are rows in the `RateLimit` table keyed by `key`;
deleting the row clears the window.

The e2e suite exhausts its own login limit — see
[testing.md](testing.md#the-database-backed-suite).

### Sessions will not clear

`User.passwordChangedAt` is the revocation clock, and the `jwt` callback only
re-reads the row **every five minutes**. A revocation can take that long to take
effect. Bumping `passwordChangedAt` is what makes it happen at all — a flow that
changes a password without bumping it signs nobody out.

### Migration drift

Never accept Prisma's offer to reset. See
[data-model.md](data-model.md#migrations).

## See also

- [Getting started](getting-started.md) — local setup and the same commands
- [data-model.md](data-model.md) — migrations in detail
- [testing.md](testing.md) — what CI actually proves
