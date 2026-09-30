# 0014 — Local database and integration tests

Status: Accepted · Date: 2026-09-30 · Resolves ADR 0007 rows 16, 17 and 27

## Context

[ADR 0007](0007-adopt-core-rules.md) rows 16, 17 and 27 list three phase-7 deviations: two Vitest
projects (`unit`, `node`) with `@/lib/db/prisma` mocked in every test that touches data, so a wrong
`where`, a missing unique index or a broken `$transaction` passes silently; local development on a
Neon branch per git branch, which needs network access and a Neon API key and puts development
data in the same project as production; and coverage leaving out `scripts/` and still excluding
`**/index.ts`. [docs/specs/core-testing.md](../specs/core-testing.md) closes all three. This record
makes permanent the trade-offs the owner took while approving it.

## Decided

**Docker Compose replaces the Neon branches.** `docker-compose.yml` runs one `postgres:17-alpine`
service on `localhost:5433`. Local work stops needing network access and a Neon API key, and
development data leaves the production Neon project. The per-branch isolation the Neon branches
gave — the fix for the 2026-08-02 migration-drift incident — is kept by giving each git branch its
own database inside the one local Postgres (`pnpm db:branch`, rewritten to talk to it instead of
the Neon API).

**Real Postgres through Testcontainers, not a mocked Prisma client.** The `integration` Vitest
project starts one `postgres:17-alpine` container per run (`@testcontainers/postgresql`), migrates
a template database once, and gives each Vitest worker its own database copied from that template —
so integration files run in parallel without sharing rows. The container image matches the Compose
Postgres and Neon's major version, so what passes locally runs in production. Docker Desktop not
running fails the run loudly at global setup, rather than skipping the integration tests silently.

**Truncation per test instead of a rolled-back transaction per test.** `STACK.md` §16 asks for a
transaction per test, rolled back at the end. The server code opens its own interactive
`$transaction`s — seven of them today — and Prisma does not nest interactive transactions, so a
test-wide wrapping transaction would either break those calls or stop testing them. Each worker's
database is truncated (`TRUNCATE ... RESTART IDENTITY CASCADE`, every table under `public` except
`_prisma_migrations`) before every test instead: the same isolation and order-independence as a
rollback, at the cost of a truncate per test rather than a commit that never happens.

**Three Vitest projects instead of two.** `STACK.md` §16 names two projects, `unit` and
`integration`. The existing `node` project (Node environment, no database, `*.node.test.ts`) still
has real work to do — route handlers, server actions and scripts that need Node's real
request/response globals but never touch a database — and renaming or merging roughly forty files
for no behavioural gain was not worth doing. `unit` and `node` together are "no database" and both
run under `pnpm test:unit` and the pre-commit hook; `integration` (real Postgres) is `*.integration.test.ts`
and runs under `pnpm test:integration` alone, since it is too slow for a pre-commit hook.

**Factories and seeds now.** `test/factories/*.ts` are faker-based builders — one per model the
tests create — replacing the hand-built fixtures and in-memory stores the mocked tests used. They
reseed the shared default `faker` instance on every `build*` call, so two builds with the same
overrides are equal and a failing test reproduces; the unique-constrained field on each model gets
a call counter appended in `create*` when the caller did not override it, so tests that intentionally
create several rows with otherwise-identical data (several converted tests do, on purpose, to
exercise ordering and draining logic) never collide. `prisma/seed.ts` fills an empty database with
three development accounts, ten favorites and three alerts with matches, using its own separately
seeded `Faker` instance — seed data is written by its own code, not by the test factories
(`STACK.md` §3) — and refuses to run against anything but `localhost`/`127.0.0.1`.

**`test/` gets the layer rules' test exemption, not the cycle rule's.** `.dependency-cruiser.cjs`
already excludes `*.test.tsx?$` files from every layer-boundary rule's `from`, because a test
imports what it tests and reaching into `lib/db/` or the generated Prisma client from a
`*.test.ts` file is the point, not a violation. `test/factories/*.ts` and `prisma/seed.ts` do the
same thing without being named `*.test.ts`, so `^test/` was added alongside the existing
`\.test\.tsx?$` exemption on every rule that already carried it. The no-circular-dependencies rule
is unchanged — nothing here exempts test files from it.

**`tsx` runs the seed.** `prisma/seed.ts` is run by `prisma db seed` (`pnpm db:seed`), through the
`seed` command in `prisma.config.ts`. Node's own `--experimental-strip-types` cannot resolve it,
because Prisma 7's generated client uses extensionless relative imports that type stripping does
not add `.ts` to. `tsx` is a dev dependency not named in `STACK.md`, owner-approved on 2026-09-30;
it is used only to run the seed.

## What would change our mind

A second Neon database for previews (phase 12) does not touch anything decided here — previews
still share the production Postgres, not the local Compose one. Deduplicating the same car across
sources, when it lands, is a separate spec and does not change the database or test setup.
