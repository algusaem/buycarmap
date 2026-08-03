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
| `unit` | push to master, pull requests | `lint` → `spec:check` → `docs:check` → `prisma generate` → `test:coverage` |
| `e2e` | pull requests only | Playwright, chromium, uploads the report as an artifact |
| `contract-live` | nightly cron (04:00 UTC) | `test:contract:live` against the real upstream APIs |

The static checks run **before** the suite because they fail in seconds.
`docs:check` runs before `prisma generate` on purpose, so a fresh clone with no
`app/generated/prisma` is the state it is proven under.

CI env vars are dummies — nothing connects to a real database or signs a real
token. The secret is padded past 32 characters only to keep the length warning
out of the logs.

**`pnpm test:e2e:db` is not in CI.** See [testing.md](testing.md#the-database-backed-suite).

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
