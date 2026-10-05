# 0019 — Environments, regions and the base branch

Status: Accepted · Date: 2026-10-04 · Resolves ADR 0007 rows 4, 6 and 26

## Context

[ADR 0007](0007-adopt-core-rules.md) named rows 4, 6 and 26 as deviations phase 12 closes: CI only
ever ran the full Playwright suite against a local app, never a real deployment; the base branch
stayed `master` instead of `main`; and there was no staging environment, no seed-only Neon parent
for previews, and no recorded regions for most processors. `docs/specs/core-environments.md`
(ENV-1 through ENV-8) is the spec; this records the four owner decisions behind it, made on
2026-10-04.

## Decided

### No staging environment

Hobby has no paid staging slot, and with three users there is no traffic volume a staging deploy
would catch that a preview wouldn't. Migrations are instead rehearsed on a temporary Neon branch of
production that auto-deletes after a day — the same procedure phase 11 used for the Better Auth
migration. Accepted as a deviation from `STACK.md` §2, revisited when either user volume or a paid
Vercel plan arrives.

### One shared `preview` Neon branch, seed data only

`STACK.md` §2 asks for a database branch per preview deployment; on the current plan that would
mean one Neon branch per open PR, migrated and seeded by hand or by automation this phase does not
build. Every preview deployment instead shares one Neon branch named `preview`, created schema-less
or from an empty parent — never a child of production — then migrated (ENV-3) and seeded once.
When an unmerged migration leaves it drifted, the fix is to recreate and reseed it
(`docs/ARCHITECTURE.md` › Environments carries the procedure), not to reconcile it by hand.
Accepted as a partial deviation from `STACK.md` §2: previews stop sharing production data, without
yet giving each one its own branch.

### The full E2E suite stays local; a smoke suite covers the real preview

`STACK.md` §16 asks for E2E against the preview. The existing Playwright suite needs the mocked
marketplace server (`e2e/fixtures/upstream-server.ts`), which a real deployment cannot use, so
moving it wholesale would mean mocking marketplaces in production-like infrastructure or dropping
upstream-fidelity coverage — neither acceptable. The full suite keeps running in CI against the
local app with mocked marketplaces; a short smoke spec (`e2e/preview-smoke.spec.ts`, ENV-5) runs
against every preview deployment instead, through `.github/workflows/e2e-preview.yml` (ENV-6),
checking that the deployment itself boots, serves its core pages and reaches its own health and
auth endpoints. Accepted as a partial deviation from `STACK.md` §16.

### The base branch stays `master`

`STACK.md` §2 and §4 ask for `main`. Renaming is a naming convention with no functional benefit: it
would cost a GitHub default-branch change, a Vercel production-branch change and an update to every
clone, for no change in behaviour. The owner chose to keep `master` permanently rather than pay that
cost. Accepted as a permanent deviation from `STACK.md` §2, §4 and `RULES.md` §21; ADR 0007 row 6 is
closed accordingly ("Kept permanently (ADR 0019)"), not reworded to `main`.

### Resend stays in `us-east-1`

`STACK.md` §2 asks for an EU region on every provider that allows one, and Resend offers `eu-west-1`.
The verified sending domain `algusaem.com` was created in `us-east-1` (North Virginia), and a Resend
domain's region cannot be changed: moving it means re-adding the domain and its DNS records, with mail
interrupted while it re-verifies. The owner chose to keep it (2026-10-05). The transfer of recipients'
addresses and email content to the US is covered by Resend's DPA
([processors.md](../privacy/processors.md)). Accepted as a permanent deviation from `STACK.md` §2.

## What it beat

**A Neon branch per open PR**, rejected for now as needing hand or automated per-PR migration and
seeding this phase does not build, for three users generating too little PR volume to justify it.

**Renaming `master` to `main`**, rejected as a naming change with a real migration cost (GitHub,
Vercel, every clone) and no behavioural benefit.

**Running the full mocked-marketplace E2E suite against a live preview deployment**, rejected
because the mock upstream server cannot run there, and dropping upstream-fidelity coverage to make
it fit was judged worse than keeping the full suite local and adding a smoke suite.

## What it costs

- Two open PRs with conflicting migrations on the shared `preview` branch can drift it; the fix is
  recreating the branch, not reconciling it.
- A preview deployment that never completes makes the required `Preview smoke` check report
  nothing, blocking the PR — intended, not a false negative.
- OAuth sign-in does not work on preview deployments (the Google and GitHub apps allow only the
  production callback URL); email sign-in still does.

## What would change our mind

- Real user volume or a paid Vercel plan — would reopen a per-PR Neon branch and a staging
  environment.
- A way to run the mocked marketplace server against a Vercel preview deployment — would reopen
  running the full E2E suite there instead of a smoke suite.

## See also

- [docs/specs/core-environments.md](../specs/core-environments.md) — ENV-1 through ENV-8
- [ARCHITECTURE.md › Environments and operations](../ARCHITECTURE.md#environments-and-operations)
- [0007](0007-adopt-core-rules.md) — rows 4, 6 and 26, resolved by this phase
- [0013](0013-platform-runtime.md) — the migration-on-deploy script this phase amends (ENV-3)
