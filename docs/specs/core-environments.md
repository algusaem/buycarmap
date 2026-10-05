# Core phase 12: environments and regions

Key: ENV
Status: Implemented
Last updated: 2026-10-04

---

## Problem

Three things about how BuyCarMap runs in Vercel and GitHub still deviate from the core
(`docs/decisions/0007-adopt-core-rules.md`):

- **CI runs E2E against a local app, not the preview** (row 4). The full Playwright suite only
  ever exercises `pnpm dev` with a mocked upstream server; nothing checks that a real deployment
  boots, serves its pages and reaches its own database.
- **The base branch stays `master`** (row 6). The owner decided on 2026-10-04 that renaming it to
  `main` is only a naming convention and buys nothing; row 6 is kept permanently, recorded in ADR
  0019, not renamed.
- **There is no staging environment, previews are not on a seed-only Neon parent, and EU regions
  are not recorded** (row 26). Measured on 2026-10-04: Vercel is on the Hobby plan, with no
  `vercel.json` and no function region configured, so functions run wherever Vercel schedules
  them rather than next to Neon's `aws-eu-central-1`. The Preview `DATABASE_URL` points at the
  production database (`docs/ARCHITECTURE.md:1212-1217`), so every preview deployment reads and
  can write production data; `scripts/migrate-deploy.mjs` avoids migrating it only by checking
  `VERCEL_ENV === "production"` (ADR 0013). `BETTER_AUTH_URL` is set for both Production and
  Preview, so a preview's OAuth callbacks and email links point at the production URL instead of
  the preview's own. `docs/privacy/processors.md` records a region for Neon, Sentry and Upstash,
  but Vercel, Resend, Google, GitHub, Have I Been Pwned, Nominatim, CARTO, Wallapop, coches.net and
  Milanuncios all read "phase 12".

Hobby has no paid staging slot, and with three users there is no traffic to justify one. The owner
decided on 2026-10-04 to close row 26 without one: migrations are rehearsed on a temporary Neon
branch that auto-deletes, as phase 11 already did, and every preview deployment shares one
long-lived Neon branch that holds only seed data, never production data. The full E2E suite stays
local in CI; a short smoke suite runs against each real preview deployment once it exists, closing
row 4 without the cost of running the mocked-marketplace suite against a live network.

This is phase 12 of ADR 0007: rows 4, 6 and 26.

## Acceptance criteria

`unit` means a Vitest test with no database or network; `node` means a `*.node.test.ts`; `e2e`
means Playwright.

### Base branch

- [x] ENV-1 · unit — Withdrawn 2026-10-04: the base branch stays `master` (owner decision, ADR 0019); nothing is renamed.

### Region

- [x] ENV-2 · unit — A root `vercel.json` pins functions to the `fra1` region (Frankfurt, next to
  Neon `aws-eu-central-1`).

### Migrations on preview

- [x] ENV-3 · node — `scripts/migrate-deploy.mjs` runs `prisma migrate deploy` when `VERCEL_ENV`
  is `production` or `preview`, and skips with one line and exit 0 otherwise.

### Seeding guard

- [x] ENV-4 · node — The seed refuses a non-local host unless `SEED_TARGET_HOST` equals that URL's
  hostname exactly.
  - The error names the refused host.
  - `localhost` and `127.0.0.1` stay allowed with no `SEED_TARGET_HOST` set.
  - This amends TEST-12 (`docs/specs/core-testing.md`) to allow seeding the shared preview branch
    deliberately; TEST-12's spec is not edited.

### Preview smoke suite

- [x] ENV-5 · e2e — A smoke spec `e2e/preview-smoke.spec.ts` runs against a deployed URL given by
  `E2E_BASE_URL`, sending `x-vercel-protection-bypass` from
  `VERCEL_AUTOMATION_BYPASS_SECRET` to clear Deployment Protection. It checks:
  - `/` returns 200 and shows the app;
  - `/login` renders the sign-in form;
  - `/api/health` returns 200;
  - `/api/auth/ok` returns `{"ok":true}`.

  It is skipped when `E2E_BASE_URL` is unset, so a local `pnpm test:e2e` run is unaffected.

### CI against the preview

- [x] ENV-6 · unit — A workflow `.github/workflows/e2e-preview.yml` runs on `deployment_status`.
  - It runs only when the state is `success` and the environment is a Vercel Preview, never
    Production.
  - It runs only `e2e/preview-smoke.spec.ts`, with `E2E_BASE_URL` set to the deployment event's
    `environment_url`.
  - Its job is named `Preview smoke`, and that name becomes a required status check on `master`'s
    branch protection, alongside the existing `Check`, `Secrets (gitleaks)`, `End-to-end
    (Playwright)` and `Conventional Commits title`.

### Processor regions

- [x] ENV-7 · unit — `docs/privacy/processors.md` gives every listed processor a region and a DPA
  link or "not applicable", so no row reads "phase 12".

### Docs and configuration

- [x] ENV-8 · unit — Docs and configuration record the change:
  - ADR 0007 rows 4 and 26 each end "Resolved in phase 12"; row 6 ends "Kept permanently (ADR
    0019)";
  - a new ADR `docs/decisions/0019-environments.md` records the four owner decisions below,
    including the decision to keep `master`;
  - `docs/ARCHITECTURE.md` › Environments describes production, the shared preview branch, local,
    and the rehearsal procedure;
  - `.env.example` documents `SEED_TARGET_HOST`.

## Worked examples

**ENV-3, `scripts/migrate-deploy.mjs`:**

| `VERCEL_ENV` | Result |
|---|---|
| `production` | migrates |
| `preview` | migrates |
| `development` | skips |
| unset | skips |

**ENV-4, the seed guard:**

| `DATABASE_URL` | `SEED_TARGET_HOST` | Result |
|---|---|---|
| `postgresql://u:p@localhost:5433/db` | unset | allowed |
| `postgresql://u:p@ep-quiet-sea-a1b2c3.eu-central-1.aws.neon.tech/neondb` | unset | refused, naming `ep-quiet-sea-a1b2c3.eu-central-1.aws.neon.tech` |
| the same URL | `ep-quiet-sea-a1b2c3.eu-central-1.aws.neon.tech` | allowed |
| the same URL | `ep-other.eu-central-1.aws.neon.tech` | refused |

## Data model

No change. No migration.

## Permissions

No change. `e2e/preview-smoke.spec.ts` carries no session; it only exercises public routes and a
health endpoint, authenticated to Vercel's edge, not the application, by the protection-bypass
header.

## Edge cases

- **Two open PRs with conflicting migrations on the shared `preview` branch.** The later one fails
  or leaves the branch drifted; the fix is to recreate the branch (`docs/ARCHITECTURE.md` ›
  Environments carries the procedure), not to patch around the drift.
- **A preview of a PR whose migration is later abandoned.** The `preview` branch keeps that
  migration's schema until it is recreated; nothing reverts it automatically.
- **Vercel does not deploy the preview.** `Preview smoke` never reports, and because it is a
  required check the PR stays blocked. This is intended: `RULES.md` §16's "no required check runs
  against a deployment that didn't happen" is satisfied by treating the missing report as a
  blocker, not a pass.
- **OAuth sign-in on preview deployments.** The Google and GitHub apps allow only the production
  callback URL, so provider sign-in fails on a preview; email sign-in still works. Accepted.

## Out of scope

- A staging environment (owner's decision 1, below).
- Per-PR Neon branches (owner's decision 2, below).
- Running the full E2E suite against preview deployments (owner's decision 3, below).
- Renaming `master` to `main` (owner decision: kept permanently).
- The Dependabot findings.
- Re-enabling Renovate: it is paused until the core migration and its dependency fixes land.

## Contracts

- **New file**: root `vercel.json`, pinning functions to `fra1`.
- **New env var**: `SEED_TARGET_HOST`, documented in `.env.example` (ENV-8).
- **New workflow**: `.github/workflows/e2e-preview.yml`, triggered by Vercel's `deployment_status`
  event.
- **New required check**: `Preview smoke`, added to `master`'s branch protection alongside the four
  existing ones.
- **Owner's manual steps**, in order, all before the PR merges (merging enables preview
  migrations):
  1. Create the Neon branch `preview` with no production data — schema-only or as an empty branch
     — and record its pooled and non-pooled connection strings.
  2. In Vercel:
     - set `DATABASE_URL` (pooled) and `DIRECT_URL` (non-pooled) for the Preview target to the
       `preview` branch's connection strings;
     - remove the Preview target from `BETTER_AUTH_URL`, so previews fall back to their own
       `VERCEL_URL` through `resolveAppUrl` (`lib/app-config.ts`);
     - remove `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and `TWO_FACTOR_ENCRYPTION_KEY`, left over from
       phase 11.
  3. In Vercel, enable Protection Bypass for Automation and add its secret to GitHub as
     `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Decisions and rationale

### No staging environment (owner's decision, 2026-10-04)

A staging environment needs Vercel Pro, and with three users there is no volume that a staging
deploy would catch and a preview wouldn't. Migrations are rehearsed instead on a temporary Neon
branch of production that auto-deletes after a day, the same procedure phase 11 used for the
Better Auth migration. ADR 0019 records this as an accepted deviation from `STACK.md` §2,
revisited when either user volume or a paid Vercel plan arrives.

### One shared `preview` Neon branch, seed data only (owner's decision, 2026-10-04)

`STACK.md` §2 asks for a database branch per preview deployment. On the current plan that would
mean one Neon branch per open PR, each migrated and seeded by hand or by extra automation this
phase does not build. Instead every preview deployment shares one Neon branch named `preview`,
created schema-less or from an empty parent — never as a child of production, which would carry
production data — then migrated and seeded once. Preview builds run `prisma migrate deploy`
against it (ENV-3). When an unmerged migration leaves it drifted, the fix is to recreate and
reseed it, not to reconcile it by hand; the procedure lives in `docs/ARCHITECTURE.md` ›
Environments. ADR 0019 records this as a partial deviation from `STACK.md` §2: previews stop
sharing production data, without yet giving each one its own branch.

### The full E2E suite stays local; a smoke suite covers the real preview (owner's decision,
2026-10-04)

`STACK.md` §16 asks for E2E against the preview. The existing Playwright suite needs the mocked
marketplace server (`e2e/fixtures/upstream-server.ts`) that a real deployment cannot use, so moving
it wholesale would mean mocking marketplaces in production-like infrastructure, or dropping
upstream-fidelity coverage — neither acceptable here. The full suite keeps running in CI against
the local app with mocked marketplaces; a short smoke spec (ENV-5) runs against every preview
deployment instead, checking that the deployment itself boots, serves its core pages and reaches
its own health and auth endpoints. ADR 0019 records this as a partial deviation from `STACK.md`
§16.

### The base branch stays `master` (owner's decision, 2026-10-04)

`STACK.md` §2 and §4 ask for `main`. Renaming is a naming convention with no functional benefit: it
would cost a GitHub default-branch change, a Vercel production-branch change and an update to
every clone, for no change in behaviour. The owner decided to keep `master` permanently rather than
pay that cost. ADR 0019 records this as an accepted, permanent deviation from `STACK.md` §2, §4 and
`RULES.md` §21; ADR 0007 row 6 is closed accordingly ("Kept permanently (ADR 0019)"), not reworded
to `main`.
